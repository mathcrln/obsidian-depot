# Cache

Each device keeps a copy of attachments it has displayed, so they load instantly and offline.

- [ ] `CAC-001` Displayed attachments are cached on the device and survive restarts.
- [ ] `CAC-002` Cached attachments display without network access.
- [ ] `CAC-003` The user can clear the cache.
- [ ] `CAC-005` Clearing the cache never removes files from storage.
- [ ] `CAC-008` The cache is kept outside the vault, so it is never synced.
- [ ] `CAC-009` The settings show the cache's size and number of files.
- [ ] `CAC-004` The cache is limited to 500 MB by default; the user can change the limit.
- [ ] `CAC-006` When the cache is full, the least recently used files are removed first.
- [?] `CAC-007` Cached files are checked against storage after a set period.
