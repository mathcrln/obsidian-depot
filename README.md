# Depot

Upload images and documents from Obsidian to private S3-compatible storage, and read them back through presigned URLs.

> Depot is under development and not yet released.

## Development

```sh
pnpm install
pnpm dev
```

`pnpm dev` compiles `src/main.ts` to `main.js` in watch mode. Clone the repository into `<Vault>/.obsidian/plugins/depot`, reload Obsidian, and enable **Depot** in **Settings → Community plugins**.

Before opening a pull request:

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:run && pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).
