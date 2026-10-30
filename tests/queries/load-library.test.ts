import { expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import type { Attachments } from '@/attachments/attachments';
import type { Storages } from '@/storages/storages';
import type { Attachment } from '@/attachments/attachment';
import { Settings } from '@/models/plugin-settings';
import { AttachmentReference } from '@/references/attachment-reference';
import { loadLibrary } from '@/queries/load-library';

it('loads ordered objects and resolves vault references through profile aliases', async () => {
	const settings = Settings.from({ profiles: [{ id: 'current', aliases: ['old'] }] });
	const file = { extension: 'md', path: 'Notes/Photo.md', stat: { mtime: 1, size: 22 } };
	const store = {
		async *list() {
			yield { key: 'z-last.pdf', size: 8, lastModified: 2 };
			yield { key: 'a-photo.png', size: 4, lastModified: 3 };
			yield { key: '.depot/ignored.json', size: 1, lastModified: 4 };
		},
	};
	const storages = { storeFor: vi.fn(() => store) } as unknown as Pick<Storages<Attachment>, 'storeFor'>;
	const app = { vault: { getFiles: () => [file], cachedRead: async () => '![](old://a-photo.png)' } } as unknown as App;
	const attachments = {
		from: (value: string) => {
			const reference = AttachmentReference.tryParse(value);
			return reference ? { reference } : undefined;
		},
	} as unknown as Pick<Attachments, 'from'>;

	const items = await loadLibrary({ app, storages, settings, attachments, profile: 'current' });

	expect(storages.storeFor).toHaveBeenCalledWith('current');
	expect(items.map(({ key, status, notes }) => ({ key, status, notes }))).toEqual([
		{ key: 'a-photo.png', status: 'used', notes: ['Notes/Photo.md'] },
		{ key: 'z-last.pdf', status: 'unused', notes: [] },
	]);
});
