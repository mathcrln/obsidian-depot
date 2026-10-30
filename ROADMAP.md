# Roadmap

## Now

1. Identifier styles and optional duplicate detection. See [uploads](docs/requirements/uploads.md).
2. A library of everything in a profile, showing what is used, unused, or broken. See [library](docs/requirements/library.md).

## Next

1. Image compression before upload. See [uploads](docs/requirements/uploads.md#image-compression).
2. Smoother everyday uploads: drops land where they are dropped, uploads show progress, linked files open well on mobile.
3. Upload to a chosen profile without opening settings.
4. A cache that stays small: size shown in settings, 500 MB limit, oldest files cleaned up. See [cache](docs/requirements/cache.md).
5. Attachments in notes load only when scrolled into view. See [rendering](docs/requirements/rendering.md).
6. Bases covers without guessing: the user chooses which properties hold covers.

## Later

1. Easier profile setup: provider presets, pasted URLs filled in automatically, and a connection test.
2. Delete unused files from the library, or mark them as kept. See [library](docs/requirements/library.md#cleanup).
3. Convert existing public links into references. See [migration](docs/requirements/migration.md).
4. Profiles that reuse another profile's credentials.

## Done

1. Private attachments: profiles, `profile://key` references, upload by paste, drop, or command, display in Reading view, Live Preview, and Bases covers, offline cache.
2. Native settings with a page per profile.
3. Custom upload paths per profile.
4. Renaming profiles, with an optional update of every reference.
5. PDF, audio, and video embeds.

See [`docs/requirements/`](docs/requirements/) for the rules behind each item.
