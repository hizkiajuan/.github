# Open-source repository standard

Every public repository of hizkiajuan follows this. `scripts/oss-apply.ts` applies the GitHub settings part and reports the rest; run it with `--check` to see drift.

## Settings (applied by the script)

- **Tabs:** Issues on. Wiki, Projects and Discussions off.
- **Merging:** squash only, the PR title is the commit title and the PR body its message, branches are deleted after merge, "Update branch" is on, auto-merge is off.
- **Branch protection:** a ruleset named `main` on the default branch, enforced: no deletion, no force push, linear history, changes through a pull request with every conversation resolved, the `ci` check must pass. The admin role bypasses it, so the maintainer's release can push the release commit and tag to main.
- **Tag protection:** a ruleset named `release-tags` on `v*` tags: nobody, the admin included, can move or delete a published release tag. New tags can be pushed.
- **Security:** secret scanning with push protection, Dependabot alerts and security updates, private vulnerability reporting.
- **Actions:** the workflow token is read-only by default and cannot approve PRs; fork PRs from first-time contributors wait for approval.
- **Labels:** `bug`, `enhancement`, `documentation`, `question`, `good first issue`, `help wanted`, `needs-triage`, `dependencies`, `accessibility`, `duplicate`, `invalid`, `wontfix`, with fixed colors. Labels are only added or recolored, never deleted.

## In each repository

- `LICENSE`: MIT, `Copyright (c) <year> Hizkia Juan`.
- `README.md`: what it is (one screenshot), install for users, develop locally, how it is built or deployed, Contributing, License ("Made by Juan and contributors").
- `CONTRIBUTING.md`: setup and checks for that project, Conventional Commit PR titles, squash merges, open an issue before a feature, AI-assisted PRs welcome when the author reviewed and tested them, contributions licensed under MIT (no CLA, no DCO).
- `SECURITY.md` only when the project needs its own scope section; otherwise the shared one applies.
- `CHANGELOG.md`, written by the release.
- `.github/ISSUE_TEMPLATE/` (bug report with the project's own fields, feature request, `config.yml` linking private vulnerability reporting) and `.github/pull_request_template.md`.
- CI: one workflow whose job is named `ci`, actions pinned by commit SHA, `permissions: contents: read`.
- Release workflow: on a pushed `v*` tag, builds the project's downloadable files in CI and attaches them to the GitHub release.
- No `.github/dependabot.yml`: maintenance-dependencies updates dependencies; Dependabot only sends security updates.
- No CODEOWNERS, no stale bot.

## Shared from this repository

`CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, reports to oss@hizkiajuan.com), `SUPPORT.md` and the fallback `SECURITY.md` apply to every public repository without its own copy. A repository must not keep its own `CODE_OF_CONDUCT.md` or `SUPPORT.md`.

## Releases

The maintainer releases with `hzkjn-release` (the `@hzkjn/kit` release CLI, run from the maintainer's machine; the kit itself stays private). It reads the version from `package.json` or `Cargo.toml`, picks the bump from Conventional Commit titles since the last tag, writes `CHANGELOG.md`, runs the gate, commits `Release vX.Y.Z`, tags, pushes and creates the GitHub release. The tag push starts the release workflow, which builds and attaches the files. Versions follow SemVer, tags are `vX.Y.Z`, and before 1.0 a feature or breaking change bumps the minor version.

## Identity

Commits are authored as `Juan` with the GitHub noreply address: checkouts live in `~/Git/Public/`, where git uses `~/.config/git/oss.config`. Security and conduct reports go to oss@hizkiajuan.com.

## By hand

- Description, homepage and topics (`gh repo edit`).
- The social preview image, 1280 x 640 (Settings, General); GitHub has no API for it.
- Pinning the repository on the profile.
- A few `good first issue` issues once the repository is public.
