# hizkiajuan/.github

Shared community health files for every public repository of [hizkiajuan](https://github.com/hizkiajuan): the [code of conduct](CODE_OF_CONDUCT.md), [support](SUPPORT.md) and the fallback [security policy](SECURITY.md). GitHub shows them in any public repository that has no copy of its own.

[STANDARD.md](STANDARD.md) describes how those repositories are set up, and `scripts/oss-apply.ts` applies it:

```sh
bun scripts/oss-apply.ts hizkiajuan/<repo>          # apply
bun scripts/oss-apply.ts hizkiajuan/<repo> --check  # report drift only
```

MIT licensed. Made by Juan.
