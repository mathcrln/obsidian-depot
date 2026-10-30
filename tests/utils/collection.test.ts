import { describe, expect, expectTypeOf, it } from 'vitest';
import { collect, Collection } from '@/utils/collection';

describe('collect', () => {
	it('creates a typed snapshot through the shorthand', () => {
		const items = collect([1, 2, 3]);

		expectTypeOf(items).toEqualTypeOf<Collection<number>>();
		expect(items.all()).toEqual([1, 2, 3]);
	});
});

describe('Collection', () => {
	describe('from and all', () => {
		it('copies the input and returned arrays while retaining item identity', () => {
			const first = { key: 'a' };
			const second = { key: 'b' };
			const source = [first, second];
			const items = Collection.from(source);

			source.reverse();
			source.push({ key: 'c' });
			const returned = items.all();
			returned.pop();

			expect(items.all()).toEqual([first, second]);
			expect(items.all()[0]).toBe(first);
			expect(source).toEqual([second, first, { key: 'c' }]);
		});

		it('accepts readonly input without freezing the item objects', () => {
			const item = { key: 'a' };
			const source: readonly { key: string }[] = [item];
			const items = Collection.from(source);

			item.key = 'changed';

			expect(items.all()[0]).toBe(item);
			expect(items.all()[0]?.key).toBe('changed');
		});
	});

	describe('count and isEmpty', () => {
		it('reports empty and populated snapshots', () => {
			expect(collect([]).count()).toBe(0);
			expect(collect([]).isEmpty()).toBe(true);
			expect(collect([0, false, '']).count()).toBe(3);
			expect(collect([0]).isEmpty()).toBe(false);
		});
	});

	describe('contains', () => {
		it('compares objects by reference', () => {
			const item = { key: 'a' };
			const items = collect([item]);

			expect(items.contains(item)).toBe(true);
			expect(items.contains({ key: 'a' })).toBe(false);
		});

		it('uses value membership for primitives, including NaN', () => {
			const items = collect([0, NaN, undefined, '']);

			expect(items.contains(0)).toBe(true);
			expect(items.contains(NaN)).toBe(true);
			expect(items.contains(undefined)).toBe(true);
			expect(items.contains('')).toBe(true);
			expect(items.contains('0')).toBe(false);
		});
	});

	describe('where', () => {
		it('uses strict property equality and preserves order', () => {
			const items = collect([
				{ key: 'a', value: 0 },
				{ key: 'b', value: '0' },
				{ key: 'c', value: 0 },
			]);

			expect(items.where('value', 0).pluck('key').all()).toEqual(['a', 'c']);
			expect(items.where('value', '0').pluck('key').all()).toEqual(['b']);
			expect(items.count()).toBe(3);
		});

		it('distinguishes absent values from null and NaN', () => {
			const items = collect<{ key: string; value?: number | null }>([
				{ key: 'absent' },
				{ key: 'null', value: null },
				{ key: 'nan', value: NaN },
			]);

			expect(items.where('value', undefined).pluck('key').all()).toEqual(['absent']);
			expect(items.where('value', null).pluck('key').all()).toEqual(['null']);
			expect(items.where('value', NaN).isEmpty()).toBe(true);
		});
	});

	describe('filter', () => {
		it('supports type guards', () => {
			const numbers = collect([1, 'two', 3, null]).filter((value): value is number => typeof value === 'number');

			expectTypeOf(numbers).toEqualTypeOf<Collection<number>>();
			expect(numbers.all()).toEqual([1, 3]);
		});

		it('evaluates once and supports independent branches sharing a result', () => {
			let calls = 0;
			const source = collect([
				{ key: 'a.png', status: 'used' },
				{ key: 'a.pdf', status: 'unused' },
				{ key: 'b.png', status: 'used' },
			]);
			const matches = source.filter((item) => {
				calls++;
				return item.key.startsWith('a');
			});

			const counts = matches.countBy('status');
			const unused = matches.where('status', 'unused');
			const used = matches.where('status', 'used');

			expect(calls).toBe(3);
			expect(counts).toEqual(
				new Map([
					['used', 1],
					['unused', 1],
				])
			);
			expect(unused.pluck('key').all()).toEqual(['a.pdf']);
			expect(used.pluck('key').all()).toEqual(['a.png']);
			expect(matches.count()).toBe(2);
			expect(source.count()).toBe(3);
		});

		it('passes the item index and preserves item identity', () => {
			const source = [{ key: 'a' }, { key: 'b' }];
			const items = collect(source).filter((_item, index) => index === 1);

			expect(items.all()[0]).toBe(source[1]);
		});
	});

	describe('map and pluck', () => {
		it('maps to a new type with the item index', () => {
			const source = collect(['a', 'b']);
			const mapped = source.map((value, index) => ({ key: value, position: index + 1 }));

			expectTypeOf(mapped).toEqualTypeOf<Collection<{ key: string; position: number }>>();
			expect(mapped.all()).toEqual([
				{ key: 'a', position: 1 },
				{ key: 'b', position: 2 },
			]);
			expect(source.all()).toEqual(['a', 'b']);
		});

		it('preserves optional property types and missing values', () => {
			const items = collect<{ key: string; size?: number }>([{ key: 'a', size: 0 }, { key: 'b' }]);
			const sizes = items.pluck('size');

			expectTypeOf(sizes).toEqualTypeOf<Collection<number | undefined>>();
			expect(sizes.all()).toEqual([0, undefined]);
		});
	});

	describe('unique', () => {
		it('keeps first occurrences, including falsy values and NaN', () => {
			expect(collect([2, 0, 2, NaN, 0, NaN, null, undefined, null]).unique().all()).toEqual([2, 0, NaN, null, undefined]);
		});

		it('uses object identity rather than structural equality', () => {
			const first = { key: 'a' };
			const second = { key: 'a' };
			const source = collect([first, second, first]);
			const unique = source.unique();

			expect(unique.all()).toEqual([first, second]);
			expect(unique.all()[0]).toBe(first);
			expect(unique.all()[1]).toBe(second);
			expect(source.count()).toBe(3);
		});
	});

	describe('ordering', () => {
		it.each([
			['asc', ['negative', 'zero', 'positive', 'null', 'undefined', 'nan']],
			['desc', ['positive', 'zero', 'negative', 'null', 'undefined', 'nan']],
		])('orders numbers %s with missing values last', (direction, expected) => {
			const source = [
				{ key: 'null', value: null },
				{ key: 'zero', value: 0 },
				{ key: 'undefined', value: undefined },
				{ key: 'positive', value: 10 },
				{ key: 'nan', value: NaN },
				{ key: 'negative', value: -5 },
			];
			const items = collect(source);
			const ordered = direction === 'asc' ? items.orderBy('value') : items.orderByDesc('value');

			expect(ordered.pluck('key').all()).toEqual(expected);
			expect(items.pluck('key').all()).toEqual(['null', 'zero', 'undefined', 'positive', 'nan', 'negative']);
			expect(source[0]?.key).toBe('null');
		});

		it('orders numeric strings ordinally and keeps equal values stable', () => {
			const items = collect([
				{ key: 'é', position: 0 },
				{ key: '2', position: 1 },
				{ key: '10', position: 2 },
				{ key: 'Z', position: 3 },
				{ key: 'a', position: 4 },
				{ key: '2', position: 5 },
			]);

			expect(items.orderBy('key').pluck('position').all()).toEqual([2, 1, 5, 3, 4, 0]);
			expect(items.orderByDesc('key').pluck('position').all()).toEqual([0, 4, 3, 1, 5, 2]);
		});

		it('orders booleans with false before true', () => {
			const items = collect([{ active: true }, { active: false }]);

			expect(items.orderBy('active').pluck('active').all()).toEqual([false, true]);
			expect(items.orderByDesc('active').pluck('active').all()).toEqual([true, false]);
		});

		it('adds tie-breaks without changing another ordering branch', () => {
			const source = collect([
				{ key: 'b', modified: 5, size: 2 },
				{ key: 'a', modified: 5, size: 3 },
				{ key: 'a', modified: 5, size: 1 },
				{ key: 'new', modified: 10, size: 4 },
			]);
			const newest = source.orderByDesc('modified');
			const tied = newest.thenBy('key').thenBy('size');

			expect(tied.pluck('size').all()).toEqual([4, 1, 3, 2]);
			expect(newest.pluck('size').all()).toEqual([4, 2, 3, 1]);
			expect(source.pluck('size').all()).toEqual([2, 3, 1, 4]);
		});

		it('replaces the previous ordering when orderBy is called again', () => {
			const items = collect([
				{ key: 'a', rank: 2 },
				{ key: 'b', rank: 1 },
			]).orderBy('rank');
			const reordered = items.orderBy('key');

			expect(reordered.pluck('key').all()).toEqual(['a', 'b']);
			expect(items.pluck('key').all()).toEqual(['b', 'a']);
		});

		it('preserves ordering through filtering and deduplication', () => {
			const first = { key: 'b', rank: 1 };
			const second = { key: 'a', rank: 1 };
			const items = collect([first, second, first])
				.orderBy('rank')
				.filter(() => true)
				.unique()
				.thenBy('key');

			expect(items.all()).toEqual([second, first]);
		});

		it('rejects thenBy without an existing ordering without changing the collection', () => {
			const items = collect([{ key: 'b' }, { key: 'a' }]);

			expect(() => items.thenBy('key')).toThrow('thenBy requires an existing ordering');
			expect(items.pluck('key').all()).toEqual(['b', 'a']);
		});

		it('drops ordering metadata when mapping changes the item shape', () => {
			const mapped = collect([{ rank: 2 }, { rank: 1 }])
				.orderBy('rank')
				.map((item) => ({ size: item.rank }));

			expect(mapped.pluck('size').all()).toEqual([1, 2]);
			expect(() => mapped.thenBy('size')).toThrow('thenBy requires an existing ordering');
		});
	});

	describe('groupBy', () => {
		it('groups by a property and preserves group and item encounter order', () => {
			const first = { key: 'a', kind: 'image' };
			const second = { key: 'b', kind: 'pdf' };
			const third = { key: 'c', kind: 'image' };
			const items = collect([first, second, third]);
			const groups = items.groupBy('kind');

			expect([...groups.keys()]).toEqual(['image', 'pdf']);
			expect(groups.get('image')?.all()).toEqual([first, third]);
			expect(groups.get('image')?.all()[0]).toBe(first);
			expect(groups.get('pdf')?.all()).toEqual([second]);
			expect(items.count()).toBe(3);
		});

		it('accepts a selector with inferred key types', () => {
			const groups = collect([1, 2, 3, 4]).groupBy((value) => value % 2);

			expectTypeOf(groups).toEqualTypeOf<Map<number, Collection<number>>>();
			expect(groups.get(1)?.all()).toEqual([1, 3]);
			expect(groups.get(0)?.all()).toEqual([2, 4]);
		});

		it('preserves optional and special property keys using a Map', () => {
			const groups = collect<{ value?: string }>([{ value: '__proto__' }, {}, { value: 'constructor' }]).groupBy('value');

			expectTypeOf(groups).toEqualTypeOf<Map<string | undefined, Collection<{ value?: string }>>>();
			expect([...groups.keys()]).toEqual(['__proto__', undefined, 'constructor']);
		});
	});

	describe('countBy', () => {
		it('counts property values without inventing absent categories', () => {
			const counts = collect([{ status: 'used' }, { status: 'unused' }, { status: 'used' }]).countBy('status');

			expect(counts).toEqual(
				new Map([
					['used', 2],
					['unused', 1],
				])
			);
			expect(counts.has('broken')).toBe(false);
		});

		it('accepts a selector and retains its key type', () => {
			const counts = collect([1, 2, 3]).countBy((value) => value % 2);

			expectTypeOf(counts).toEqualTypeOf<Map<number, number>>();
			expect(counts).toEqual(
				new Map([
					[1, 2],
					[0, 1],
				])
			);
		});
	});

	describe('empty transformations', () => {
		it('returns empty snapshots and maps without calling predicates', () => {
			let calls = 0;
			const items = collect<{ key: string }>([]);
			const filtered = items.filter(() => {
				calls++;
				return true;
			});

			expect(
				filtered
					.map((item) => item.key)
					.unique()
					.all()
			).toEqual([]);
			expect(items.where('key', 'a').orderBy('key').thenBy('key').all()).toEqual([]);
			expect(items.orderByDesc('key').all()).toEqual([]);
			expect(items.pluck('key').all()).toEqual([]);
			expect(items.groupBy('key')).toEqual(new Map());
			expect(items.countBy('key')).toEqual(new Map());
			expect(calls).toBe(0);
		});
	});

	describe('property types', () => {
		it('exposes only scalar ordering keys and retains optional equality types', () => {
			const items = collect<{ key: string; rank?: number; tags: string[]; meta: { label: string } }>([]);

			expectTypeOf(items.orderBy).parameter(0).toEqualTypeOf<'key' | 'rank'>();
			expectTypeOf(items.orderByDesc).parameter(0).toEqualTypeOf<'key' | 'rank'>();
			expectTypeOf(items.where<'rank'>)
				.parameter(1)
				.toEqualTypeOf<number | undefined>();
		});
	});
});
