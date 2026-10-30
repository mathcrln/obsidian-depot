import { describe, expect, it } from 'vitest';
import { groupByMonth } from '@/library/library-groups';
import type { LibraryItem } from '@/library/library-item';

describe('groupByMonth', () => {
	it('groups items by upload month, newest month first, keeping item order', () => {
		const sept = GivenItem('sept.png', new Date(2026, 8, 5));
		const octEarly = GivenItem('oct-early.png', new Date(2026, 9, 2));
		const octLate = GivenItem('oct-late.png', new Date(2026, 9, 28));

		const groups = groupByMonth([sept, octLate, octEarly], 'en-US');

		expect(groups.map((group) => group.label)).toEqual(['October 2026', 'September 2026']);
		expect(groups[0]?.items).toEqual([octLate, octEarly]);
		expect(groups[1]?.items).toEqual([sept]);
	});

	it('splits at the month boundary', () => {
		const lastSecond = GivenItem('a.png', new Date(2026, 8, 30, 23, 59, 59));
		const firstSecond = GivenItem('b.png', new Date(2026, 9, 1, 0, 0, 0));

		const groups = groupByMonth([firstSecond, lastSecond], 'en-US');

		expect(groups.map((group) => group.items)).toEqual([[firstSecond], [lastSecond]]);
	});

	it('orders months across years', () => {
		const groups = groupByMonth(
			[GivenItem('a.png', new Date(2025, 11, 1)), GivenItem('b.png', new Date(2026, 0, 1))],
			'en-US'
		);

		expect(groups.map((group) => group.label)).toEqual(['January 2026', 'December 2025']);
	});

	it('puts broken references first in their own section', () => {
		const broken = GivenItem('gone.png', undefined, 'broken');
		const dated = GivenItem('a.png', new Date(2026, 9, 2));

		const groups = groupByMonth([dated, broken], 'en-US');

		expect(groups.map((group) => [group.id, group.label])).toEqual([
			['broken', 'Broken references'],
			['2026-10', 'October 2026'],
		]);
		expect(groups[0]?.items).toEqual([broken]);
	});

	it('puts undated items that exist last', () => {
		const undated = GivenItem('x.png', undefined);
		const dated = GivenItem('a.png', new Date(2026, 9, 2));

		expect(groupByMonth([undated, dated], 'en-US').map((group) => group.label)).toEqual(['October 2026', 'Unknown date']);
	});

	it('returns no groups for no items', () => {
		expect(groupByMonth([], 'en-US')).toEqual([]);
	});
});

function GivenItem(key: string, date: Date | undefined, status: LibraryItem['status'] = 'used'): LibraryItem {
	return { profile: 'main', key, kind: 'image', status, notes: [], lastModified: date?.getTime() };
}
