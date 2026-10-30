<h1 align="center">Depot</h1>

<p align="center">
  Private attachments for Obsidian.<br>
  Keep images and files in your own S3-compatible bucket, and link them from your notes
  without public URLs or expiring tokens.
</p>

<p align="center">
  <a href="https://github.com/mathcrln/depot/actions/workflows/ci.yml">
    <img src="https://github.com/mathcrln/depot/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-0BSD-blue" alt="License">
  </a>
</p>

> Depot is under development and not yet released.

## Features

- 🔒 Store images and files in your own private S3 or Cloudflare R2 bucket, not in your vault
- 🔗 Notes keep a clean link such as `mybucket://photo.jpg`: no public URLs, no expiring tokens
- 📋 Paste, drag and drop, or pick a file, and it is uploaded and linked
- 🖼️ Images show in Reading view, Live Preview, and Bases card covers (covers are best effort, since Obsidian doesn't offer an API for them yet)
- 📄 PDF, audio, and video embeds
- ⚡ Cached on your device, so attachments load instantly and work offline
- 🗂️ Several storage profiles (personal, work, public…), each with its own bucket
- 🛤️ Choose where files go in the bucket: by date, by type, or by note
- 🧬 Content-hash file names, so the same file always gets the same name
- ♻️ Optional duplicate detection that works across devices
- ✏️ Rename a profile and update every link in your vault at once
- 🖼️ A library of everything in your bucket: search it, and see what is used, unused, or broken
- 🔑 Credentials stay in Obsidian's secret storage, never in your notes or settings
- 📱 Works on desktop and mobile

## How it works

Instead of writing a public URL into your note:

```md
![](https://cdn.example.com/family/photo.jpg)
```

Depot writes a reference to the object:

```md
![](mybucket://2026/10/53670a34e119ae832528b72f8bd8750e.jpg)
```

`mybucket` is the name of a storage profile you configure. When Obsidian displays the note, Depot signs a request with your credentials, downloads the file, caches it on your device, and shows it. The bucket stays private, and the note never contains a URL that anyone else could open.

Because the note only stores the profile name and the object's path, you can later change the bucket, endpoint, or credentials without editing a single note.

## Install

Depot is not in the community plugin directory yet. To install it manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Copy them to `<Vault>/.obsidian/plugins/depot/`.
3. Reload Obsidian and enable **Depot** in **Settings → Community plugins**.

Depot requires Obsidian 1.13 or later.

## Set up

1. Open **Settings → Depot** and add a profile. Its name is what your links start with, for example `mybucket`.
2. On the profile's page, fill in the connection:
    - **Endpoint**: for Cloudflare R2, `https://<account-id>.r2.cloudflarestorage.com`, without the bucket name. Leave it empty for AWS S3.
    - **Bucket**: the bucket's name.
    - **Region**: `auto` for R2, or your AWS region.
    - **Path-style addressing**: only needed for MinIO and some self-hosted services.
3. Enter the **Access key ID** and **Secret access key**. Depot saves them in Obsidian's secret storage.
4. Choose the **Default profile**: pasted, dropped, and uploaded files go there.

The keys need permission to read and write objects. For the library they also need to list the bucket. R2 tokens with object access include listing; on AWS, grant `s3:ListBucket`.

## Uploading

Paste or drop a file into a note, or run **Depot: Upload attachment**. Depot uploads it and inserts a link. If the upload fails, nothing is inserted.

## Upload paths

Each profile decides where files go in the bucket, with a pattern such as `{yyyy}/{mm}/{id}.{ext}` → `2026/10/53670a34….webp`.

| Placeholder            | Value                                     |
| ---------------------- | ----------------------------------------- |
| `{yyyy}` `{mm}` `{dd}` | Upload date                               |
| `{name}` `{ext}`       | Original file name and extension          |
| `{type}`               | `image`, `pdf`, `audio`, `video`, `other` |
| `{note}`               | Note you uploaded into                    |
| `{id}`                 | Unique ID (required)                      |

`{id}` is a content hash by default, so the same file always gets the same name. UUID v7, UUID v4, short random, and ULID are also available.

Turn on **Detect duplicates** to reuse files you already uploaded, even from another device. It adds a small record to the bucket for each upload, so it is off by default.

## Library

Run **Depot: Open library** to browse everything in a profile, grouped by month. Search, open files full size, and see which ones are **used**, **unused** in this vault, or **broken**. The library never deletes or changes files.

## Renaming a profile

**Rename profile** can update every link in your vault, or keep the old name working as an alias.

## Privacy and network use

- Depot only connects to the storage endpoints you configure, and only to upload, download, or list your own files. There is no telemetry.
- Credentials are kept in Obsidian's secret storage. Notes and plugin settings only contain profile names and object paths.
- Downloaded files are cached on each device, outside the vault, so they are not synced. Select **Clear cache** in the settings to remove them.

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
