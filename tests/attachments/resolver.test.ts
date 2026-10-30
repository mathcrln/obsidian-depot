import { describe, expect, it } from 'vitest';
import { Resolver } from '@/attachments/resolver';
import { MemoryObjectCache } from '@/cache/memory-object-cache';
import type { ObjectCache } from '@/cache/object-cache';
import { AttachmentReference } from '@/references/attachment-reference';
import type { ProfileId } from '@/references/profile-id';
import { ObjectNotFound, type ObjectStore, type ObjectSummary, type StoredObject } from '@/storages/object-store';
import { ProfileDeleted } from '@/storages/profile-errors';
import { FakeObjectUrls } from '../support/fake-object-urls';

describe('Resolver', () => {
	it('serves a cache hit without calling the store', async () => {
		const { resolver, store, cache } = GivenResolver();
		await cache.write('work', 'a.png', { bytes: Bytes(1), contentType: 'image/png' });

		const resolved = await WhenResolving(resolver, 'work://a.png');

		expect(resolved).toEqual({ url: 'blob:fake/1', contentType: 'image/png' });
		expect(store.gets).toEqual([]);
	});

	it('fetches from the store on a miss and writes the cache', async () => {
		const { resolver, store, cache } = GivenResolver();
		store.has('a.png', { bytes: Bytes(1, 2), contentType: 'image/png', etag: 'v1' });

		const resolved = await WhenResolving(resolver, 'work://a.png');

		expect(resolved.contentType).toBe('image/png');
		expect(store.gets).toEqual(['a.png']);
		expect((await cache.read('work', 'a.png'))?.etag).toBe('v1');
	});

	it('creates the object URL from the fetched bytes', async () => {
		const { resolver, store, objectUrls } = GivenResolver();
		store.has('a.png', { bytes: Bytes(7), contentType: 'image/png' });

		await WhenResolving(resolver, 'work://a.png');

		expect(objectUrls.created.map((entry) => entry.contentType)).toEqual(['image/png']);
		expect(Array.from(new Uint8Array(objectUrls.created[0]!.bytes))).toEqual([7]);
	});

	it('shares one in-flight fetch between concurrent resolves', async () => {
		const { resolver, store } = GivenResolver();
		store.has('a.png', { bytes: Bytes(1), contentType: 'image/png' });

		const [first, second] = await Promise.all([
			WhenResolving(resolver, 'work://a.png'),
			WhenResolving(resolver, 'work://a.png'),
		]);

		expect(store.gets).toEqual(['a.png']);
		expect(first).toEqual(second);
	});

	it('reuses one object URL per reference', async () => {
		const { resolver, store, objectUrls } = GivenResolver();
		store.has('a.png', { bytes: Bytes(1), contentType: 'image/png' });

		const first = await WhenResolving(resolver, 'work://a.png');
		const second = await WhenResolving(resolver, 'work://a.png');

		expect(second.url).toBe(first.url);
		expect(objectUrls.created).toHaveLength(1);
	});

	it('propagates store errors and does not memoise the failure', async () => {
		const { resolver, store } = GivenResolver();

		await expect(WhenResolving(resolver, 'work://a.png')).rejects.toBeInstanceOf(ObjectNotFound);

		store.has('a.png', { bytes: Bytes(1), contentType: 'image/png' });
		const resolved = await WhenResolving(resolver, 'work://a.png');

		expect(resolved.contentType).toBe('image/png');
		expect(store.gets).toEqual(['a.png', 'a.png']);
	});

	it('rejects when the profile lookup throws synchronously', async () => {
		const resolver = new Resolver({
			storeFor: () => {
				throw new ProfileDeleted('work');
			},
			cache: new MemoryObjectCache(),
			objectUrls: new FakeObjectUrls(),
		});

		await expect(WhenResolving(resolver, 'work://a.png')).rejects.toBeInstanceOf(ProfileDeleted);
	});

	it('still resolves when the cache write fails', async () => {
		const failingCache: ObjectCache = {
			read: async () => undefined,
			write: async () => {
				throw new Error('quota exceeded');
			},
			clear: async () => {},
		};
		const { resolver, store } = GivenResolver({ cache: failingCache });
		store.has('a.png', { bytes: Bytes(1), contentType: 'image/png' });

		const resolved = await WhenResolving(resolver, 'work://a.png');

		expect(resolved.contentType).toBe('image/png');
	});

	it('revokes every object URL on release and forgets results', async () => {
		const { resolver, store, objectUrls } = GivenResolver();
		store.has('a.png', { bytes: Bytes(1), contentType: 'image/png' });
		store.has('b.png', { bytes: Bytes(2), contentType: 'image/png' });
		await WhenResolving(resolver, 'work://a.png');
		await WhenResolving(resolver, 'work://b.png');

		resolver.release();

		expect(objectUrls.revoked.sort()).toEqual(['blob:fake/1', 'blob:fake/2']);
		const again = await WhenResolving(resolver, 'work://a.png');
		expect(again.url).toBe('blob:fake/3');
	});
});

class RecordingStore implements ObjectStore {
	readonly gets: string[] = [];
	private readonly objects = new Map<string, StoredObject>();

	has(key: string, object: StoredObject): void {
		this.objects.set(key, object);
	}

	async *list(): AsyncGenerator<ObjectSummary> {}

	async get(key: string): Promise<StoredObject> {
		this.gets.push(key);
		const found = this.objects.get(key);
		if (!found) throw new ObjectNotFound(key);

		return found;
	}

	async put(): Promise<void> {}

	async head(): Promise<never> {
		throw new Error('not used');
	}
}

function GivenResolver(overrides: { cache?: ObjectCache } = {}) {
	const store = new RecordingStore();
	const cache = new MemoryObjectCache();
	const objectUrls = new FakeObjectUrls();
	const resolver = new Resolver({
		storeFor: (_profile: ProfileId) => store,
		cache: overrides.cache ?? cache,
		objectUrls,
	});

	return { resolver, store, cache, objectUrls };
}

function Bytes(...values: number[]): ArrayBuffer {
	return new Uint8Array(values).buffer;
}

function WhenResolving(resolver: Resolver, reference: string) {
	return resolver.resolve(AttachmentReference.parse(reference));
}
