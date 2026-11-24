# Contributing

This repository holds the shared community files and the open-source standard for hizkiajuan's public repositories. Changes here apply to every one of them, so open an issue first to discuss a change.

- Pull requests use a Conventional Commit title (`docs: ...`, `fix: ...`) and are squash-merged.
- `bun fmt scripts` formats the script, and CI checks that `scripts/oss-apply.ts` compiles.
- After a change to `STANDARD.md` or the script, run `bun scripts/oss-apply.ts hizkiajuan/<repo> --check` on each public repository and apply where it drifts.

By submitting a pull request, you agree that your contribution is licensed under the [MIT License](LICENSE).
