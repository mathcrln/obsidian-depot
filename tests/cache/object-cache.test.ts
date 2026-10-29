import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObjectCache } from '@/cache/object-cache';
import { MemoryObjectCache } from '@/cache/memory-object-cache';
import { IndexedDbObjectCache } from '@/cache/indexed-db-object-cache';

type CacheFactory = () => Promise<ObjectCache>;

describe.each<[string, CacheFactory]>([
	['MemoryObjectCache', async () => new MemoryObjectCache()],
	['IndexedDbObjectCache', async () => IndexedDbObjectCache.open('depot-test', new IDBFactory())],
])('%s', (_name, createCache) => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(1_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns undefined on a miss', async () => {
		const cache = await createCache();

		expect(await cache.read('work', 'a.png')).toBeUndefined();
	});

	it('returns what was written', async () => {
		const cache = await createCache();
		await cache.write('work', 'a.png', GivenObject([1, 2, 3], { etag: 'v1' }));

		const found = await cache.read('work', 'a.png');

		expect(found).toBeDefined();
		expect(Array.from(new Uint8Array(found!.bytes))).toEqual([1, 2, 3]);
		expect(found!.contentType).toBe('image/png');
		expect(found!.etag).toBe('v1');
		expect(found!.size).toBe(3);
		expect(found!.lastAccessed).toBe(1_000);
	});

	it('isolates profiles sharing the same key', async () => {
		const cache = await createCache();
		await cache.write('work', 'a.png', GivenObject([1]));
		await cache.write('home', 'a.png', GivenObject([2, 2]));

		const work = await cache.read('work', 'a.png');
		const home = await cache.read('home', 'a.png');

		expect(Array.from(new Uint8Array(work!.bytes))).toEqual([1]);
		expect(Array.from(new Uint8Array(home!.bytes))).toEqual([2, 2]);
		expect(await cache.read('other', 'a.png')).toBeUndefined();
	});

	it('replaces an object when overwritten', async () => {
		const cache = await createCache();
		await cache.write('work', 'a.png', GivenObject([1, 2, 3], { etag: 'v1' }));
		await cache.write('work', 'a.png', GivenObject([9], { contentType: 'image/jpeg', etag: 'v2' }));

		const found = await cache.read('work', 'a.png');

		expect(Array.from(new Uint8Array(found!.bytes))).toEqual([9]);
		expect(found!.contentType).toBe('image/jpeg');
		expect(found!.etag).toBe('v2');
		expect(found!.size).toBe(1);
	});

	it('updates lastAccessed on read', async () => {
		const cache = await createCache();
		await cache.write('work', 'a.png', GivenObject([1]));

		vi.setSystemTime(5_000);
		await cache.read('work', 'a.png');
		vi.setSystemTime(9_000);
		const found = await cache.read('work', 'a.png');

		expect(found!.lastAccessed).toBe(9_000);
	});

	it('empties everything on clear', async () => {
		const cache = await createCache();
		await cache.write('work', 'a.png', GivenObject([1]));
		await cache.write('home', 'b.png', GivenObject([2]));

		await cache.clear();

		expect(await cache.read('work', 'a.png')).toBeUndefined();
		expect(await cache.read('home', 'b.png')).toBeUndefined();
	});
});

describe('IndexedDbObjectCache persistence', () => {
	it('keeps objects across close and re-open', async () => {
		const factory = new IDBFactory();
		const first = await IndexedDbObjectCache.open('depot-test', factory);
		await first.write('work', 'a.png', GivenObject([4, 5]));
		first.close();

		const second = await IndexedDbObjectCache.open('depot-test', factory);
		const found = await second.read('work', 'a.png');
		second.close();

		expect(Array.from(new Uint8Array(found!.bytes))).toEqual([4, 5]);
	});

	it('keeps caches with different names separate', async () => {
		const factory = new IDBFactory();
		const first = await IndexedDbObjectCache.open('depot-one', factory);
		await first.write('work', 'a.png', GivenObject([1]));

		const second = await IndexedDbObjectCache.open('depot-two', factory);

		expect(await second.read('work', 'a.png')).toBeUndefined();
	});
});

function GivenObject(bytes: number[], overrides: { contentType?: string; etag?: string } = {}) {
	return {
		bytes: new Uint8Array(bytes).buffer,
		contentType: overrides.contentType ?? 'image/png',
		...(overrides.etag === undefined ? {} : { etag: overrides.etag }),
	};
}
