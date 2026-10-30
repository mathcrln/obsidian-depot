# Storage profiles

A storage profile is one configured object-storage destination. Notes refer to it by its identifier.

## Profiles

- [ ] `STO-001` The user can configure multiple storage profiles.
- [ ] `STO-002` Each storage profile has an identifier that is unique among the configured profiles.
- [ ] `STO-003` A storage profile can target any S3-compatible object-storage service.
- [ ] `STO-004` Each storage profile has its own endpoint, bucket, region, and credentials.
- [ ] `STO-006` The user can mark one storage profile as the default.
- [?] `STO-009` When exactly one storage profile exists, it is the default.

## Identifiers

- [ ] `STO-010` A profile identifier cannot be a scheme that Obsidian or the web already handles, such as `http`, `https`, `file`, `mailto`, or `obsidian`.
- [?] `STO-011` A profile identifier starts with a lowercase letter and contains only lowercase letters, digits, and hyphens.
- [ ] `STO-019` The user can rename a storage profile.
- [ ] `STO-020` Renaming a storage profile offers to update every reference to it in the vault.
- [ ] `STO-021` The user sees which notes a rename would change before any note is modified.
- [ ] `STO-022` Updating references after a rename changes only the profile part of each reference.
- [ ] `STO-023` References that still use a profile's previous identifier keep resolving to the renamed profile.
- [ ] `STO-017` The identifiers of deleted storage profiles remain known to the plugin.
- [ ] `STO-018` Creating a profile with a deleted profile's identifier makes its existing references resolve again.

## Connection settings

- [ ] `STO-013` A storage profile works with only its bucket, credentials, and, for services other than AWS S3, its endpoint configured.
- [ ] `STO-014` A storage profile can use path-style bucket addressing.
- [ ] `STO-015` Choosing a provider preset (Cloudflare R2, AWS S3, Backblaze B2, or MinIO) fills in the endpoint pattern and addressing style.
- [ ] `STO-016` The user can test a storage profile's connection from its settings.
- [ ] `STO-024` Pasting a bucket URL into the endpoint fills in the endpoint, bucket, and region it contains.

## Credentials

- [ ] `STO-005` Storage credentials are kept in Obsidian secret storage and never in plugin settings.
- [ ] `STO-008` A storage profile can use another profile's credentials.
