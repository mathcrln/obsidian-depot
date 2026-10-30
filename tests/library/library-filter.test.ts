import { describe, expect, it } from 'vitest';
import { adjacentItem, countByStatus, filterLibrary } from '@/library/library-filter';
import type { LibraryItem } from '@/library/library-item';

describe('filterLibrary', () => {
	it('returns every item for an empty query, all kinds and all statuses', () => {
		const items = [GivenItem('a.png'), GivenItem('b.pdf')];

		expect(filterLibrary(items, { query: '', kind: 'all', status: 'all' })).toEqual(items);
	});

	it('matches the object path case-insensitively', () => {
		const match = GivenItem('2026/Holiday/Beach.PNG');
		const items = [match, GivenItem('2026/work/chart.png')];

		expect(filterLibrary(items, { query: 'holiday', kind: 'all', status: 'all' })).toEqual([match]);
	});

	it('matches the paths of the notes that use the object', () => {
		const match = GivenItem('a.png', { notes: ['Trips/Japan.md'] });
		const items = [match, GivenItem('b.png', { notes: ['Work/Plan.md'] })];

		expect(filterLibrary(items, { query: 'japan', kind: 'all', status: 'all' })).toEqual([match]);
	});

	it('requires every word to match, across the path and the notes', () => {
		const match = GivenItem('beach.png', { notes: ['Trips/Japan.md'] });
		const items = [
			match,
			GivenItem('beach.png', { notes: ['Work/Plan.md'] }),
			GivenItem('lake.png', { notes: ['Trips/Japan.md'] }),
		];

		expect(filterLibrary(items, { query: '  JAPAN   beach ', kind: 'all', status: 'all' })).toEqual([match]);
	});

	it('filters by kind', () => {
		const pdf = GivenItem('a.pdf');

		expect(filterLibrary([GivenItem('a.png'), pdf], { query: '', kind: 'pdf', status: 'all' })).toEqual([pdf]);
	});

	it('filters by status', () => {
		const unused = GivenItem('a.png', { status: 'unused' });

		expect(filterLibrary([GivenItem('b.png'), unused], { query: '', kind: 'all', status: 'unused' })).toEqual([unused]);
	});
});

describe('countByStatus', () => {
	it('counts items per status for the query and kind, ignoring the status filter', () => {
		const items = [
			GivenItem('beach.png', { status: 'used' }),
			GivenItem('beach2.png', { status: 'unused' }),
			GivenItem('beach3.png', { status: 'unused' }),
			GivenItem('beach.pdf', { status: 'broken' }),
			GivenItem('lake.png', { status: 'used' }),
		];

		expect(countByStatus(items, { query: 'beach', kind: 'image' })).toEqual({ all: 3, used: 1, unused: 2, broken: 0 });
	});
});

describe('adjacentItem', () => {
	it('returns the next and previous items', () => {
		const [a, b, c] = [GivenItem('a.png'), GivenItem('b.png'), GivenItem('c.png')];

		expect(adjacentItem([a, b, c], b, 1)).toBe(c);
		expect(adjacentItem([a, b, c], b, -1)).toBe(a);
	});

	it('returns undefined past either end', () => {
		const [a, b] = [GivenItem('a.png'), GivenItem('b.png')];

		expect(adjacentItem([a, b], b, 1)).toBeUndefined();
		expect(adjacentItem([a, b], a, -1)).toBeUndefined();
	});

	it('returns undefined when the item is not in the list', () => {
		expect(adjacentItem([GivenItem('a.png')], GivenItem('z.png'), 1)).toBeUndefined();
	});
});

function GivenItem(key: string, overrides: Partial<LibraryItem> = {}): LibraryItem {
	const kind = key.endsWith('.pdf') ? 'pdf' : 'image';

	return { profile: 'main', key, kind, status: 'used', notes: [], ...overrides };
}
