#!/usr/bin/env bun
/**
 * Applies the open-source repository standard (STANDARD.md) to one repository, or reports where it
 * drifts with --check.
 *
 *   bun scripts/oss-apply.ts hizkiajuan/pinprompt          apply
 *   bun scripts/oss-apply.ts hizkiajuan/pinprompt --check  report only, exit 1 on drift
 *
 * Needs an authenticated `gh` with admin rights on the repository. Safe to run again: it only
 * changes what differs. It never deletes labels or files.
 */

const REQUIRED_CHECK = "ci";

const REPO_SETTINGS = {
  has_issues: true,
  has_wiki: false,
  has_projects: false,
  has_discussions: false,
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  allow_auto_merge: false,
  allow_update_branch: true,
  delete_branch_on_merge: true,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
} as const;

const LABELS: readonly { name: string; color: string; description: string }[] =
  [
    { name: "bug", color: "d73a4a", description: "Something isn't working" },
    {
      name: "enhancement",
      color: "a2eeef",
      description: "New feature or request",
    },
    {
      name: "documentation",
      color: "0075ca",
      description: "Improvements or additions to documentation",
    },
    {
      name: "question",
      color: "d876e3",
      description: "Further information is requested",
    },
    {
      name: "good first issue",
      color: "7057ff",
      description: "Good for newcomers",
    },
    {
      name: "help wanted",
      color: "008672",
      description: "Extra attention is needed",
    },
    {
      name: "needs-triage",
      color: "fbca04",
      description: "Not reviewed by the maintainer yet",
    },
    {
      name: "dependencies",
      color: "0366d6",
      description: "Dependency updates",
    },
    { name: "accessibility", color: "f143ab", description: "Accessibility" },
    {
      name: "duplicate",
      color: "cfd3d7",
      description: "This issue or pull request already exists",
    },
    {
      name: "invalid",
      color: "e4e669",
      description: "This doesn't seem right",
    },
    {
      name: "wontfix",
      color: "ffffff",
      description: "This will not be worked on",
    },
  ];

const RULESET = {
  name: "main",
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  // The admin role bypasses the rules, so the maintainer's `hzkjn-release` can push the release
  // commit and tag straight to main.
  bypass_actors: [
    { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
  ],
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: [{ context: REQUIRED_CHECK }],
      },
    },
  ],
};

const COMMUNITY_FILES_IN_REPO = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
];
const SHARED_FILES = ["CODE_OF_CONDUCT.md", "SUPPORT.md"];

const [repo, ...flags] = process.argv.slice(2);
const checkOnly = flags.includes("--check");
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error("Usage: bun scripts/oss-apply.ts <owner/repo> [--check]");
  process.exit(2);
}

const drift: string[] = [];
const notes: string[] = [];

function gh(args: string[], input?: unknown): unknown {
  const result = Bun.spawnSync(
    ["gh", "api", ...args, ...(input ? ["--input", "-"] : [])],
    {
      stdin: input ? new TextEncoder().encode(JSON.stringify(input)) : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (!result.success) {
    throw new Error(
      `gh api ${args.join(" ")}: ${result.stderr.toString().trim()}`,
    );
  }
  const out = result.stdout.toString().trim();
  return out ? JSON.parse(out) : null;
}

function ghStatus(path: string): number {
  const result = Bun.spawnSync(["gh", "api", "-i", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const status = /^HTTP\/[\d.]+ (\d{3})/.exec(result.stdout.toString());
  return status ? Number(status[1]) : 0;
}

function fix(what: string, apply: () => void) {
  drift.push(what);
  if (!checkOnly) apply();
}

// Repository settings and tabs.
const current = gh([`repos/${repo}`]) as Record<string, unknown> & {
  visibility: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  security_and_analysis?: Record<string, { status: string }>;
};
if (current.visibility !== "public")
  notes.push(`${repo} is ${current.visibility}, not public`);
const changed = Object.fromEntries(
  Object.entries(REPO_SETTINGS).filter(
    ([key, value]) => current[key] !== value,
  ),
);
if (Object.keys(changed).length > 0) {
  fix(`settings: ${Object.keys(changed).join(", ")}`, () =>
    gh(["-X", "PATCH", `repos/${repo}`], changed),
  );
}
const security = current.security_and_analysis ?? {};
const wantSecurity = [
  "secret_scanning",
  "secret_scanning_push_protection",
].filter((key) => security[key]?.status !== "enabled");
if (wantSecurity.length > 0) {
  fix(`security: ${wantSecurity.join(", ")}`, () =>
    gh(["-X", "PATCH", `repos/${repo}`], {
      security_and_analysis: Object.fromEntries(
        wantSecurity.map((key) => [key, { status: "enabled" }]),
      ),
    }),
  );
}
if (!current.description)
  notes.push("no description (gh repo edit --description)");
if (!current.homepage) notes.push("no homepage (gh repo edit --homepage)");
if (current.topics.length === 0)
  notes.push("no topics (gh repo edit --add-topic)");

// Dependabot alerts and security updates, private vulnerability reporting.
if (ghStatus(`repos/${repo}/vulnerability-alerts`) !== 204) {
  fix("Dependabot alerts", () =>
    gh(["-X", "PUT", `repos/${repo}/vulnerability-alerts`]),
  );
}
const fixes = gh([`repos/${repo}/automated-security-fixes`]) as {
  enabled: boolean;
};
if (!fixes.enabled) {
  fix("Dependabot security updates", () =>
    gh(["-X", "PUT", `repos/${repo}/automated-security-fixes`]),
  );
}
const reporting = gh([`repos/${repo}/private-vulnerability-reporting`]) as {
  enabled: boolean;
};
if (!reporting.enabled) {
  fix("private vulnerability reporting", () =>
    gh(["-X", "PUT", `repos/${repo}/private-vulnerability-reporting`]),
  );
}

// Actions: read-only token by default, approval for first-time contributors' fork PRs.
const workflow = gh([`repos/${repo}/actions/permissions/workflow`]) as {
  default_workflow_permissions: string;
  can_approve_pull_request_reviews: boolean;
};
if (
  workflow.default_workflow_permissions !== "read" ||
  workflow.can_approve_pull_request_reviews
) {
  fix("Actions token read-only, cannot approve PRs", () =>
    gh(["-X", "PUT", `repos/${repo}/actions/permissions/workflow`], {
      default_workflow_permissions: "read",
      can_approve_pull_request_reviews: false,
    }),
  );
}
const approval = gh([
  `repos/${repo}/actions/permissions/fork-pr-contributor-approval`,
]) as {
  approval_policy: string;
};
if (approval.approval_policy !== "first_time_contributors") {
  fix("fork PR approval for first-time contributors", () =>
    gh(
      [
        "-X",
        "PUT",
        `repos/${repo}/actions/permissions/fork-pr-contributor-approval`,
      ],
      {
        approval_policy: "first_time_contributors",
      },
    ),
  );
}

// Labels: create the missing ones and align colors and descriptions. Extra labels stay.
const labels = gh([`repos/${repo}/labels?per_page=100`]) as {
  name: string;
  color: string;
  description: string | null;
}[];
for (const label of LABELS) {
  const found = labels.find(
    (item) => item.name.toLowerCase() === label.name.toLowerCase(),
  );
  if (!found) {
    fix(`label ${label.name}`, () =>
      gh(["-X", "POST", `repos/${repo}/labels`], label),
    );
  } else if (
    found.color.toLowerCase() !== label.color ||
    (found.description ?? "") !== label.description
  ) {
    fix(`label ${label.name} color or description`, () =>
      gh(
        [
          "-X",
          "PATCH",
          `repos/${repo}/labels/${encodeURIComponent(found.name)}`,
        ],
        {
          new_name: label.name,
          color: label.color,
          description: label.description,
        },
      ),
    );
  }
}

// The main ruleset.
const rulesets = gh([`repos/${repo}/rulesets`]) as {
  id: number;
  name: string;
}[];
const existing = rulesets.find((ruleset) => ruleset.name === RULESET.name);
if (!existing) {
  fix("ruleset main", () =>
    gh(["-X", "POST", `repos/${repo}/rulesets`], RULESET),
  );
} else {
  const full = gh([`repos/${repo}/rulesets/${existing.id}`]) as {
    enforcement: string;
    rules: {
      type: string;
      parameters?: { required_status_checks?: { context: string }[] };
    }[];
    bypass_actors: { actor_id: number }[];
  };
  const checks = full.rules
    .find((rule) => rule.type === "required_status_checks")
    ?.parameters?.required_status_checks?.map((check) => check.context);
  const same =
    full.enforcement === "active" &&
    RULESET.rules.every((rule) =>
      full.rules.some((have) => have.type === rule.type),
    ) &&
    checks?.length === 1 &&
    checks[0] === REQUIRED_CHECK &&
    full.bypass_actors.some((actor) => actor.actor_id === 5);
  if (!same) {
    fix(`ruleset main (required check ${REQUIRED_CHECK})`, () =>
      gh(["-X", "PUT", `repos/${repo}/rulesets/${existing.id}`], RULESET),
    );
  }
}

// Files: the repo's own, and the shared ones it must not shadow.
for (const file of COMMUNITY_FILES_IN_REPO) {
  if (ghStatus(`repos/${repo}/contents/${file}`) !== 200)
    notes.push(`missing ${file}`);
}
for (const file of SHARED_FILES) {
  if (ghStatus(`repos/${repo}/contents/${file}`) === 200) {
    notes.push(
      `${file} shadows the shared one in hizkiajuan/.github; delete it`,
    );
  }
}
if (ghStatus(`repos/${repo}/contents/.github/dependabot.yml`) === 200) {
  notes.push(
    ".github/dependabot.yml found; maintenance-dependencies is the one updater",
  );
}

const verb = checkOnly ? "Drift" : "Applied";
console.log(
  drift.length
    ? `${verb}:\n- ${drift.join("\n- ")}`
    : `${repo} matches the standard.`,
);
if (notes.length) console.log(`By hand:\n- ${notes.join("\n- ")}`);
console.log(
  "Also by hand: the social preview image (Settings, General) and pinning the repo on the profile.",
);
if (checkOnly && (drift.length || notes.length)) process.exit(1);
