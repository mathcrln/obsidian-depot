# Contributing

Issues and pull requests of any size are welcome.

## Getting started

```sh
pnpm install
pnpm dev
```

## Before opening a pull request

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:run && pnpm build
```

- Keep it to one change per pull request.
- Write the test first, in `tests/`, mirroring the path of the code it covers.
- Match the surrounding code, and prefer clear names over comments.
- Format with `pnpm format`.
- Write commit messages in [Conventional Commits](https://www.conventionalcommits.org) style.

## Security

Please email oss@madinco.com rather than opening a public issue.
