import { describe, expect, it } from 'vitest';
import type { ReferenceUse } from '@/library/library-item';
import { inventoryOf } from '@/library/inventory';
import type { ObjectSummary } from '@/storages/object-store';

describe('inventoryOf', () => {
	it('marks an object used by a note as used', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [GivenObject('a.png', { size: 5, lastModified: 100 })],
			uses: [GivenUse('a.png', 'n.md')],
		});

		expect(items).toEqual([
			{ profile: 'main', key: 'a.png', kind: 'image', status: 'used', notes: ['n.md'], size: 5, lastModified: 100 },
		]);
	});

	it('marks an object without uses as unused with no notes', () => {
		const items = inventoryOf({ profile: 'main', objects: [GivenObject('a.pdf')], uses: [] });

		expect(items[0]).toMatchObject({ key: 'a.pdf', kind: 'pdf', status: 'unused', notes: [] });
	});

	it('lists distinct notes sorted', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [GivenObject('a.png')],
			uses: [GivenUse('a.png', 'z.md'), GivenUse('a.png', 'b.md'), GivenUse('a.png', 'z.md')],
		});

		expect(items[0]?.notes).toEqual(['b.md', 'z.md']);
	});

	it('lists a used key without object as broken with its notes', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [],
			uses: [GivenUse('gone.mp4', 'b.md'), GivenUse('gone.mp4', 'a.md')],
		});

		expect(items).toEqual([{ profile: 'main', key: 'gone.mp4', kind: 'video', status: 'broken', notes: ['a.md', 'b.md'] }]);
	});

	it('lists a broken key once however many times it is used', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [],
			uses: [GivenUse('gone.png', 'a.md'), GivenUse('gone.png', 'a.md')],
		});

		expect(items).toHaveLength(1);
	});

	it('never lists objects under .depot', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [GivenObject('.depot/hashes/abc'), GivenObject('a.png')],
			uses: [],
		});

		expect(items.map((item) => item.key)).toEqual(['a.png']);
	});

	it('does not treat a similarly named key as depot records', () => {
		const items = inventoryOf({ profile: 'main', objects: [GivenObject('.depotx/a.png')], uses: [] });

		expect(items.map((item) => item.key)).toEqual(['.depotx/a.png']);
	});

	it('ignores uses of other profiles', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [GivenObject('a.png')],
			uses: [GivenUse('a.png', 'n.md', 'other'), GivenUse('ghost.png', 'n.md', 'other')],
		});

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ key: 'a.png', status: 'unused', notes: [] });
	});

	it('orders broken first, then newest first, then by key', () => {
		const items = inventoryOf({
			profile: 'main',
			objects: [
				GivenObject('old.png', { lastModified: 1 }),
				GivenObject('b.png', { lastModified: 5 }),
				GivenObject('a.png', { lastModified: 5 }),
				GivenObject('new.png', { lastModified: 9 }),
			],
			uses: [GivenUse('missing.png', 'n.md')],
		});

		expect(items.map((item) => item.key)).toEqual(['missing.png', 'new.png', 'a.png', 'b.png', 'old.png']);
	});

	it('orders several broken items by key', () => {
		const items = inventoryOf({ profile: 'main', objects: [], uses: [GivenUse('b.png', 'n.md'), GivenUse('a.png', 'n.md')] });

		expect(items.map((item) => item.key)).toEqual(['a.png', 'b.png']);
	});
});

function GivenObject(key: string, options: { size?: number; lastModified?: number } = {}): ObjectSummary {
	return { key, size: options.size ?? 1, lastModified: options.lastModified ?? 0 };
}

function GivenUse(key: string, note: string, profile = 'main'): ReferenceUse {
	return { profile, key, note };
}
