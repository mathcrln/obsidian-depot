import { describe, expect, it } from 'vitest';
import { ProfileId } from '@/references/profile-id';
import type { AttachmentReference } from '@/references/attachment-reference';
import { Profile } from '@/storages/profile';
import type { UploadableFile } from '@/storages/profile';
import { FakeObjectStore } from '../support/fake-object-store';

describe('upload', () => {
	it('puts the bytes under a generated key with the file content type', async () => {
		const { profile, store } = GivenProfile();

		await profile.upload(GivenFile('photo.png', [1, 2, 3], 'image/png'));

		expect(store.puts).toHaveLength(1);
		expect(store.puts[0]?.key).toMatch(/^attachments\/[0-9A-Z]{26}\.png$/);
		expect(store.puts[0]?.contentType).toBe('image/png');
		expect(new Uint8Array(store.puts[0]?.bytes ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('infers the content type from the name when the file reports none', async () => {
		const { profile, store } = GivenProfile();

		await profile.upload(GivenFile('doc.pdf', [1]));

		expect(store.puts[0]?.contentType).toBe('application/pdf');
	});

	it('attaches a reference to the stored key under this profile', async () => {
		const { profile, store, attached } = GivenProfile();

		const result = await profile.upload(GivenFile('photo.png', [1]));

		expect(result).toBe('attached');
		expect(attached[0]?.reference.toString()).toBe(`r2://${store.puts[0]?.key}`);
		expect(attached[0]?.name).toBe('photo.png');
	});

	it('fails without attaching when the store fails', async () => {
		const { profile, store, attached } = GivenProfile();
		store.failWith(new Error('boom'));

		await expect(profile.upload(GivenFile('photo.png', [1]))).rejects.toThrow('boom');

		expect(attached).toEqual([]);
	});
});

function GivenProfile() {
	const store = new FakeObjectStore();
	const attached: { reference: AttachmentReference; name: string }[] = [];
	const profile = new Profile({
		id: ProfileId.parse('r2'),
		store,
		attach: (reference, name) => {
			attached.push({ reference, name });

			return 'attached';
		},
	});

	return { profile, store, attached };
}

function GivenFile(name: string, bytes: number[], type?: string): UploadableFile {
	return {
		name,
		...(type === undefined ? {} : { type }),
		arrayBuffer: async () => new Uint8Array(bytes).buffer,
	};
}
