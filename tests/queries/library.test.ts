import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { AttachmentReference } from '@/references/attachment-reference';
import type { Attachments } from '@/attachments/attachments';
import type { Attachment } from '@/attachments/attachment';
import { Library } from '@/queries/library';
import { Settings } from '@/models/plugin-settings';
import type { Storages } from '@/storages/storages';

it('loads a selected profile through the capability bound to app and services', async () => {
	const settings = Settings.from({ profiles: [{ id: 'personal' }] });
	const storeFor = vi.fn(() => ({
		async *list() {
			yield { key: 'photo.png', size: 3, lastModified: 1 };
		},
	}));
	const library = new Library({
		app: { vault: { getFiles: () => [], cachedRead: async () => '' } } as unknown as App,
		attachments: { from: () => undefined } as unknown as Attachments,
		settings,
		storages: { storeFor } as unknown as Storages<Attachment>,
	});

	const items = await library.load('personal');

	expect(storeFor).toHaveBeenCalledWith('personal');
	expect(items).toMatchObject([{ profile: 'personal', key: 'photo.png', status: 'unused' }]);
});

describe('reference scan cache', () => {
	it('does not re-read an unchanged note on a later load', async () => {
		const { library, cachedRead } = GivenLibrary({ files: [GivenNote('a.md', 1, '![](personal://photo.png)')] });

		await library.load('personal');
		const items = await library.load('personal');

		expect(cachedRead).toHaveBeenCalledOnce();
		expect(items[0]).toMatchObject({ key: 'photo.png', status: 'used', notes: ['a.md'] });
	});

	it('re-reads a note whose modified time changed', async () => {
		const note = GivenNote('a.md', 1, '![](personal://photo.png)');
		const { library, cachedRead, contents } = GivenLibrary({ files: [note] });
		await library.load('personal');

		contents.set('a.md', 'no reference');
		note.stat.mtime = 2;
		const items = await library.load('personal');

		expect(cachedRead).toHaveBeenCalledTimes(2);
		expect(items[0]).toMatchObject({ status: 'unused', notes: [] });
	});

	it('drops a deleted note and reads it again if it comes back', async () => {
		const note = GivenNote('a.md', 1, '![](personal://photo.png)');
		const { library, cachedRead, files } = GivenLibrary({ files: [note] });
		await library.load('personal');

		files.length = 0;
		const gone = await library.load('personal');
		files.push(note);
		await library.load('personal');

		expect(gone[0]).toMatchObject({ status: 'unused', notes: [] });
		expect(cachedRead).toHaveBeenCalledTimes(2);
	});

	it('resolves cached references through a profile renamed after caching', async () => {
		const { library, cachedRead, settings } = GivenLibrary({ files: [GivenNote('a.md', 1, '![](personal://photo.png)')] });
		await library.load('personal');

		settings.renameProfile('personal', 'work');
		const items = await library.load('work');

		expect(cachedRead).toHaveBeenCalledOnce();
		expect(items[0]).toMatchObject({ profile: 'work', status: 'used', notes: ['a.md'] });
	});

	it('does not cache a failed read', async () => {
		const note = GivenNote('a.md', 1, '![](personal://photo.png)');
		const { library, cachedRead } = GivenLibrary({ files: [note] });
		cachedRead.mockRejectedValueOnce(new Error('locked'));
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const failed = await library.load('personal');
		const retried = await library.load('personal');

		expect(failed[0]).toMatchObject({ status: 'unused' });
		expect(retried[0]).toMatchObject({ status: 'used' });
		expect(cachedRead).toHaveBeenCalledTimes(2);
	});
});

interface Note {
	extension: string;
	path: string;
	stat: { mtime: number; size: number };
}

function GivenNote(path: string, mtime: number, text: string): Note {
	notes.set(path, text);

	return { extension: 'md', path, stat: { mtime, size: text.length } };
}

const notes = new Map<string, string>();

function GivenLibrary({ files }: { files: Note[] }) {
	const contents = notes;
	const settings = Settings.from({ profiles: [{ id: 'personal' }] });
	const cachedRead = vi.fn(async (file: Note) => contents.get(file.path) ?? '');
	const library = new Library({
		app: { vault: { getFiles: () => files, cachedRead } } as unknown as App,
		attachments: {
			from: (value: string) => {
				const reference = AttachmentReference.tryParse(value);
				return reference ? { reference } : undefined;
			},
		} as unknown as Attachments,
		settings,
		storages: {
			storeFor: () => ({
				async *list() {
					yield { key: 'photo.png', size: 3, lastModified: 1 };
				},
			}),
		} as unknown as Storages<Attachment>,
	});

	return { library, cachedRead, contents, files, settings };
}
