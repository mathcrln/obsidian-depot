# Migration

Moving attachments into and out of Depot.

## Public links

- [ ] `MIG-001` A command converts links that start with a given base URL into references to a chosen storage profile.
- [ ] `MIG-002` Conversion covers every note and canvas in the vault.
- [ ] `MIG-003` The user sees which notes and how many links would change before any note is modified.
- [ ] `MIG-006` Conversion keeps the object path that follows the base URL.

## Import from the vault

- [ ] `MIG-007` A command uploads the attachments in chosen vault folders to a storage profile.
- [ ] `MIG-008` Notes that embed or link an imported attachment are updated to reference it.
- [ ] `MIG-009` The user sees which files and notes would change before anything is uploaded or modified.
- [ ] `MIG-010` Imported files stay in the vault until the user chooses to remove them.

## Export to the vault

- [ ] `MIG-011` A command downloads a storage profile's attachments into a vault folder.
- [ ] `MIG-012` References to exported attachments become ordinary vault links.
- [ ] `MIG-013` The user sees which notes would change before any note is modified.

## Watched folder

- [?] `MIG-014` The user can choose one vault folder whose new files are uploaded automatically.
- [?] `MIG-015` Notes that embed a file uploaded from the watched folder are updated to reference it.
- [?] `MIG-016` Removing the local copy after upload is off by default.
