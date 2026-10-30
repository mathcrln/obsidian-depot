import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { IndexedDbUploadRegistry } from '@/uploads/indexed-db-upload-registry';
import { MemoryUploadRegistry } from '@/uploads/memory-upload-registry';
import type { UploadRegistry } from '@/uploads/upload-registry';

type RegistryFactory = () => Promise<UploadRegistry>;

describe.each<[string, RegistryFactory]>([
	['MemoryUploadRegistry', async () => new MemoryUploadRegistry()],
	['IndexedDbUploadRegistry', async () => IndexedDbUploadRegistry.open('depot-test', new IDBFactory())],
])('%s', (_name, createRegistry) => {
	it('returns undefined on a miss', async () => {
		const registry = await createRegistry();

		expect(await registry.find('work', 'abc')).toBeUndefined();
	});

	it('returns the key remembered for a hash', async () => {
		const registry = await createRegistry();
		await registry.remember('work', 'abc', '2026/10/a.webp');

		expect(await registry.find('work', 'abc')).toBe('2026/10/a.webp');
	});

	it('isolates profiles sharing the same hash', async () => {
		const registry = await createRegistry();
		await registry.remember('work', 'abc', 'one.png');
		await registry.remember('home', 'abc', 'two.png');

		expect(await registry.find('work', 'abc')).toBe('one.png');
		expect(await registry.find('home', 'abc')).toBe('two.png');
		expect(await registry.find('other', 'abc')).toBeUndefined();
	});

	it('replaces the key when remembered again', async () => {
		const registry = await createRegistry();
		await registry.remember('work', 'abc', 'old.png');
		await registry.remember('work', 'abc', 'new.png');

		expect(await registry.find('work', 'abc')).toBe('new.png');
	});

	it('forgets everything on clear', async () => {
		const registry = await createRegistry();
		await registry.remember('work', 'abc', 'a.png');
		await registry.remember('home', 'def', 'b.png');

		await registry.clear();

		expect(await registry.find('work', 'abc')).toBeUndefined();
		expect(await registry.find('home', 'def')).toBeUndefined();
	});
});

describe('IndexedDbUploadRegistry persistence', () => {
	it('keeps entries across close and re-open', async () => {
		const factory = new IDBFactory();
		const first = await IndexedDbUploadRegistry.open('depot-test', factory);
		await first.remember('work', 'abc', 'a.png');
		first.close();

		const second = await IndexedDbUploadRegistry.open('depot-test', factory);
		const found = await second.find('work', 'abc');
		second.close();

		expect(found).toBe('a.png');
	});

	it('keeps registries with different names separate', async () => {
		const factory = new IDBFactory();
		const first = await IndexedDbUploadRegistry.open('depot-one', factory);
		await first.remember('work', 'abc', 'a.png');

		const second = await IndexedDbUploadRegistry.open('depot-two', factory);

		expect(await second.find('work', 'abc')).toBeUndefined();
	});
});
