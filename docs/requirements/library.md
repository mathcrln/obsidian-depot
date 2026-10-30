# Library

The library is a view of everything stored in a storage profile, compared with what the vault references.

## Browsing

- [ ] `LIB-001` The user can open a library view listing the objects stored in a storage profile.
- [ ] `LIB-002` The library shows images as thumbnails.
- [ ] `LIB-003` The library loads a thumbnail only when it comes into view.
- [ ] `LIB-004` The library can be filtered by storage profile.
- [ ] `LIB-005` The library can be filtered by file kind.
- [ ] `LIB-006` The library never shows Depot's own records.

## Usage

- [ ] `LIB-007` Each object in the library is marked as used or unused by the notes in the vault.
- [ ] `LIB-008` The library lists references to objects that do not exist as broken.
- [ ] `LIB-009` The library can be filtered by used, unused, or broken.
- [ ] `LIB-010` References written with a profile's previous name count as uses of that profile.
- [ ] `LIB-011` The library states that unused means unused in this vault.

## Details

- [ ] `LIB-012` Selecting an object shows its preview, path, size, upload date, and the notes that use it.
- [ ] `LIB-013` The user can open a note that uses an object from its details.
- [ ] `LIB-014` The user can copy an object's reference from the library.
- [ ] `LIB-015` The user can insert an object's reference into the note being edited from the library.

## Cleanup

- [ ] `LIB-017` The user can delete selected unused files from storage.
- [ ] `LIB-018` Before deleting, the user sees the list of files and their total size, and confirms.
- [ ] `LIB-019` The library never deletes a file without that confirmation.
- [ ] `LIB-020` The user can mark unused files as kept; kept files are no longer listed as unused.
