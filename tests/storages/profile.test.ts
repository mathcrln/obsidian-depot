import { describe, expect, it } from 'vitest';
import { ProfileId } from '@/references/profile-id';
import type { AttachmentReference } from '@/references/attachment-reference';
import { Profile } from '@/storages/profile';
import type { UploadableFile, UploadSettings } from '@/storages/profile';
import { MemoryUploadRegistry } from '@/uploads/memory-upload-registry';
import { PathPattern } from '@/uploads/path-pattern';
import { FakeObjectStore } from '../support/fake-object-store';

const SHA_OF_ONE_TWO_THREE = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81';

const DEFAULT_SETTINGS: UploadSettings = {
	pathPattern: PathPattern.DEFAULT.toString(),
	lowercaseNames: true,
	idStyle: 'content-hash',
	detectDuplicates: false,
};

describe('upload', () => {
	it('puts the bytes under a key built from the profile pattern with the file content type', async () => {
		const { profile, store } = GivenProfile();

		await profile.upload(GivenFile('photo.png', [1, 2, 3], 'image/png'));

		expect(store.puts).toHaveLength(1);
		expect(store.puts[0]?.key).toMatch(/^\d{4}\/\d{2}\/039058c6f2c0cb492c533b0a4d14ef77\.png$/);
		expect(store.puts[0]?.contentType).toBe('image/png');
		expect(new Uint8Array(store.puts[0]?.bytes ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('uses the profile pattern and options with the note of the upload', async () => {
		const { profile, store } = GivenProfile({ pathPattern: '{note}/{name}-{id}', lowercaseNames: false });

		await profile.upload(GivenFile('Photo.png', [1]), { note: 'My Note' });

		expect(store.puts[0]?.key).toMatch(/^My-Note\/Photo-[0-9a-f]{32}$/);
	});

	it('uses the untitled name when there is no note', async () => {
		const { profile, store } = GivenProfile({ pathPattern: '{note}/{id}' });

		await profile.upload(GivenFile('photo.png', [1]));

		expect(store.puts[0]?.key).toMatch(/^untitled\/[0-9a-f]{32}$/);
	});

	it('infers the content type from the name when the file reports none', async () => {
		const { profile, store } = GivenProfile();

		await profile.upload(GivenFile('doc.pdf', [1]));

		expect(store.puts[0]?.contentType).toBe('application/pdf');
	});

	it('attaches a reference to the stored key under this profile', async () => {
		const { profile, store, attached } = GivenProfile();

		const result = await profile.upload(GivenFile('photo.png', [1]));

		expect(result).toEqual({ attachment: 'attached', reused: false });
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

describe('identifier style', () => {
	it('gives identical files the same content-hash id and different files another', async () => {
		const { profile, store } = GivenProfile({ pathPattern: '{id}' });

		await profile.upload(GivenFile('a.png', [1, 2, 3]));
		await profile.upload(GivenFile('b.png', [1, 2, 3]));
		await profile.upload(GivenFile('c.png', [9]));

		expect(store.puts.map((put) => put.key)).toEqual([
			SHA_OF_ONE_TWO_THREE.slice(0, 32),
			expect.stringMatching(/^[0-9a-f]{32}$/),
		]);
		expect(store.puts[1]?.key).not.toBe(store.puts[0]?.key);
	});

	it.each([
		['uuid-v7', /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/],
		['uuid-v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/],
		['short', /^[0-9A-Za-z]{10}$/],
		['ulid', /^[0-9A-HJKMNP-TV-Z]{26}$/],
	] as const)('uses a %s id when the profile asks for it', async (idStyle, format) => {
		const { profile, store } = GivenProfile({ pathPattern: '{id}', idStyle });

		await profile.upload(GivenFile('a.png', [1, 2, 3]));
		await profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(store.puts[0]?.key).toMatch(format);
		expect(store.puts[1]?.key).toMatch(format);
		expect(store.puts[1]?.key).not.toBe(store.puts[0]?.key);
	});
});

describe('duplicate detection off', () => {
	it('neither reads nor writes markers and does not use the registry', async () => {
		const { profile, store, registry } = GivenProfile({ detectDuplicates: false });

		const result = await profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(result.reused).toBe(false);
		expect(store.gets).toEqual([]);
		expect(store.puts.map((put) => put.key.startsWith('.depot/'))).toEqual([false]);
		expect(await registry.find('r2', SHA_OF_ONE_TWO_THREE)).toBeUndefined();
	});
});

describe('duplicate detection on', () => {
	it('stores a marker named after the full hash holding the object key', async () => {
		const { profile, store } = GivenProfile({ detectDuplicates: true });

		await profile.upload(GivenFile('a.png', [1, 2, 3]));

		const marker = store.puts.find((put) => put.key === `.depot/hashes/${SHA_OF_ONE_TWO_THREE}`);
		expect(marker?.contentType).toBe('text/plain');
		expect(new TextDecoder().decode(marker?.bytes)).toBe(store.puts[0]?.key);
	});

	it('remembers the upload locally', async () => {
		const { profile, store, registry } = GivenProfile({ detectDuplicates: true });

		await profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(await registry.find('r2', SHA_OF_ONE_TWO_THREE)).toBe(store.puts[0]?.key);
	});

	it('reuses the existing object for an identical file without uploading again', async () => {
		const { profile, store, attached } = GivenProfile({ detectDuplicates: true });
		await profile.upload(GivenFile('a.png', [1, 2, 3]));
		const putsBefore = store.puts.length;

		const result = await profile.upload(GivenFile('renamed.png', [1, 2, 3]));

		expect(result.reused).toBe(true);
		expect(store.puts).toHaveLength(putsBefore);
		expect(attached[1]?.reference.toString()).toBe(attached[0]?.reference.toString());
		expect(attached[1]?.name).toBe('renamed.png');
	});

	it('answers from the local registry without reading the marker', async () => {
		const { profile, store } = GivenProfile({ detectDuplicates: true });
		await profile.upload(GivenFile('a.png', [1, 2, 3]));
		const readsBefore = store.gets.length;

		await profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(store.gets).toHaveLength(readsBefore);
	});

	it('uploads a file that differs', async () => {
		const { profile, store } = GivenProfile({ detectDuplicates: true });
		await profile.upload(GivenFile('a.png', [1, 2, 3]));

		const result = await profile.upload(GivenFile('a.png', [4]));

		expect(result.reused).toBe(false);
		expect(store.puts.filter((put) => !put.key.startsWith('.depot/'))).toHaveLength(2);
	});

	it('recognises a file uploaded from another device through the marker and remembers it', async () => {
		const store = new FakeObjectStore();
		await GivenProfile({ detectDuplicates: true, store }).profile.upload(GivenFile('a.png', [1, 2, 3]));
		const other = GivenProfile({ detectDuplicates: true, store });
		const putsBefore = store.puts.length;

		const result = await other.profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(result.reused).toBe(true);
		expect(store.puts).toHaveLength(putsBefore);
		expect(await other.registry.find('r2', SHA_OF_ONE_TWO_THREE)).toBe(store.puts[0]?.key);
	});

	it('uploads again when the original object no longer exists', async () => {
		const { profile, store } = GivenProfile({ detectDuplicates: true });
		await profile.upload(GivenFile('a.png', [1, 2, 3]));
		store.remove(store.puts[0]?.key ?? '');

		const result = await profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(result.reused).toBe(false);
		expect(store.puts.some((put) => !put.key.startsWith('.depot/'))).toBe(true);
	});

	it('uploads again from another device when the marker points at a missing object', async () => {
		const store = new FakeObjectStore();
		await GivenProfile({ detectDuplicates: true, store }).profile.upload(GivenFile('a.png', [1, 2, 3]));
		store.remove(store.puts[0]?.key ?? '');
		const other = GivenProfile({ detectDuplicates: true, store });

		const result = await other.profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(result.reused).toBe(false);
		expect(await other.registry.find('r2', SHA_OF_ONE_TWO_THREE)).toMatch(/\.png$/);
	});

	it('reuses again after having uploaded a replacement', async () => {
		const { profile, store } = GivenProfile({ detectDuplicates: true });
		await profile.upload(GivenFile('a.png', [1, 2, 3]));
		store.remove(store.puts[0]?.key ?? '');
		await profile.upload(GivenFile('a.png', [1, 2, 3]));

		const result = await profile.upload(GivenFile('a.png', [1, 2, 3]));

		expect(result.reused).toBe(true);
	});
});

function GivenProfile(overrides: Partial<UploadSettings> & { store?: FakeObjectStore } = {}) {
	const { store = new FakeObjectStore(), ...settings } = overrides;
	const registry = new MemoryUploadRegistry();
	const attached: { reference: AttachmentReference; name: string }[] = [];
	const profile = new Profile({
		id: ProfileId.parse('r2'),
		store,
		registry,
		settings: { ...DEFAULT_SETTINGS, ...settings },
		attach: (reference, name) => {
			attached.push({ reference, name });

			return 'attached';
		},
	});

	return { profile, store, registry, attached };
}

function GivenFile(name: string, bytes: number[], type?: string): UploadableFile {
	return {
		name,
		...(type === undefined ? {} : { type }),
		arrayBuffer: async () => new Uint8Array(bytes).buffer,
	};
}
