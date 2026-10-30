# Uploads

Uploading stores a file in object storage and inserts an object reference into the note.

## Uploading

- [ ] `UPL-001` Pasting a file into a note uploads it to object storage.
- [ ] `UPL-002` Dropping a file into a note uploads it to object storage.
- [ ] `UPL-003` Uploads use the default storage profile without asking for a profile.
- [ ] `UPL-004` The user can upload to a storage profile other than the default.
- [ ] `UPL-005` A successful upload inserts an object reference, never an HTTP URL.
- [ ] `UPL-006` A failed upload inserts nothing into the note.
- [ ] `UPL-007` Any file type can be uploaded.
- [ ] `UPL-043` A placeholder appears in the note while a file uploads and is replaced by its reference when done.
- [ ] `UPL-044` A failed upload removes its placeholder.
- [ ] `UPL-045` A dropped file is inserted where it was dropped.
- [ ] `UPL-046` A command uploads files to a chosen storage profile.
- [ ] `UPL-047` Holding Shift while dropping files asks which storage profile to use.

## Object paths

- [ ] `UPL-008` Each storage profile has its own object path pattern.
- [ ] `UPL-009` A new storage profile uses the pattern `{yyyy}/{mm}/{id}.{ext}`.
- [ ] `UPL-010` A path pattern can include the upload date with `{yyyy}`, `{mm}`, and `{dd}`.
- [ ] `UPL-011` A path pattern can include the uploaded file's original name with `{name}` and its extension with `{ext}`.
- [ ] `UPL-012` A path pattern can include the file's kind (`image`, `pdf`, `audio`, `video`, or `other`) with `{type}`.
- [ ] `UPL-013` A path pattern can include the name of the note being uploaded into with `{note}`; uploads without a note use `untitled`.
- [ ] `UPL-014` A path pattern must include the unique identifier `{id}`.
- [ ] `UPL-015` An upload never replaces an existing object.
- [ ] `UPL-016` Names placed in an object path keep letters and digits and turn every other run of characters into a single hyphen.
- [ ] `UPL-017` Changing a profile's path pattern leaves existing references unchanged.
- [ ] `UPL-018` The user can choose whether names in object paths are lowercased; they are by default.
- [ ] `UPL-020` The path pattern setting shows an example of the next upload's path.
- [ ] `UPL-021` An invalid path pattern is rejected with the reason and is not saved.

## Identifiers

- [ ] `UPL-022` Each storage profile chooses how `{id}` is generated: content hash, UUID v7, UUID v4, short random, or ULID.
- [ ] `UPL-023` A new storage profile uses content-hash identifiers.
- [ ] `UPL-024` Identical files always receive the same content-hash identifier.

## Duplicate detection

- [ ] `UPL-025` The user can turn on duplicate detection for each storage profile; it is off by default.
- [ ] `UPL-026` With duplicate detection on, uploading a file identical to one already uploaded to the profile inserts the existing reference without uploading it again.
- [ ] `UPL-027` Duplicate detection recognises files uploaded from other devices.
- [ ] `UPL-028` The user is told when an existing upload is reused.
- [ ] `UPL-029` A duplicate whose original object no longer exists is uploaded again.
- [ ] `UPL-030` The duplicate detection setting explains that it adds a request and a small record in the bucket for each upload.

## Image compression

- [ ] `UPL-031` Images are compressed before upload; new profiles have compression on.
- [ ] `UPL-032` The user can turn image compression off for each storage profile.
- [ ] `UPL-033` Compressed images are saved as WebP, or as JPEG on devices that cannot create WebP.
- [ ] `UPL-034` The user can set the compression quality as a percentage.
- [ ] `UPL-035` Compressed photos keep their orientation.
- [ ] `UPL-036` Compression removes photo metadata, including location.
- [ ] `UPL-037` The user can choose to keep photo metadata; it is removed by default.
- [ ] `UPL-038` Compression shrinks images so their longest side is at most 2560 pixels; the user can change this limit.
- [ ] `UPL-039` GIFs and SVGs are uploaded unchanged.
- [ ] `UPL-040` An image that compression would not make smaller is uploaded unchanged.
- [ ] `UPL-041` After compressing an upload, the user sees how much smaller it got and its final size.
- [ ] `UPL-042` Duplicate detection compares the original files, before compression.
