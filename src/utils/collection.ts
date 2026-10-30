import { Str } from '@/utils/str';

export type OrderableKey<T> = {
	[K in keyof T]-?: NonNullable<T[K]> extends string
		? K
		: NonNullable<T[K]> extends number
			? K
			: NonNullable<T[K]> extends boolean
				? K
				: never;
}[keyof T];

type Comparator<T> = (a: T, b: T) => number;
type Selector<T> = keyof T | ((item: T) => unknown);

/** An eager array snapshot whose transformations retain item identity. */
export class Collection<T> {
	private constructor(
		private readonly items: readonly T[],
		private readonly ordering?: Comparator<T>
	) {}

	static from<T>(items: readonly T[]): Collection<T> {
		return new Collection([...items]);
	}

	all(): T[] {
		return [...this.items];
	}

	count(): number {
		return this.items.length;
	}

	isEmpty(): boolean {
		return this.items.length === 0;
	}

	contains(item: T): boolean {
		return this.items.includes(item);
	}

	where<K extends keyof T>(key: K, value: NoInfer<T[K]>): Collection<T> {
		return this.filter((item) => item[key] === value);
	}

	filter<S extends T>(predicate: (item: T, index: number) => item is S): Collection<S>;
	filter(predicate: (item: T, index: number) => boolean): Collection<T>;
	filter(predicate: (item: T, index: number) => boolean): Collection<T> {
		return new Collection(
			this.items.filter((item, index) => predicate(item, index)),
			this.ordering
		);
	}

	map<U>(transform: (item: T, index: number) => U): Collection<U> {
		return new Collection(this.items.map((item, index) => transform(item, index)));
	}

	pluck<K extends keyof T>(key: K): Collection<T[K]> {
		return this.map((item) => item[key]);
	}

	unique(): Collection<T> {
		return new Collection([...new Set(this.items)], this.ordering);
	}

	orderBy(key: OrderableKey<T>): Collection<T> {
		return this.orderedBy(comparing(key, 1));
	}

	orderByDesc(key: OrderableKey<T>): Collection<T> {
		return this.orderedBy(comparing(key, -1));
	}

	thenBy(key: OrderableKey<T>): Collection<T> {
		const ordering = this.ordering;
		if (!ordering) throw new Error('thenBy requires an existing ordering');

		const tieBreak = comparing<T>(key, 1);

		return this.orderedBy((a, b) => ordering(a, b) || tieBreak(a, b));
	}

	groupBy<K extends keyof T>(key: K): Map<T[K], Collection<T>>;
	groupBy<K>(selector: (item: T) => K): Map<K, Collection<T>>;
	groupBy(selector: Selector<T>): Map<unknown, Collection<T>> {
		const groups = new Map<unknown, T[]>();

		for (const item of this.items) {
			const key = valueOf(item, selector);
			const group = groups.get(key);
			if (group) group.push(item);
			else groups.set(key, [item]);
		}

		const result = new Map<unknown, Collection<T>>();
		for (const [key, items] of groups) {
			result.set(key, new Collection(items, this.ordering));
		}

		return result;
	}

	countBy<K extends keyof T>(key: K): Map<T[K], number>;
	countBy<K>(selector: (item: T) => K): Map<K, number>;
	countBy(selector: Selector<T>): Map<unknown, number> {
		const counts = new Map<unknown, number>();

		for (const item of this.items) {
			const key = valueOf(item, selector);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}

		return counts;
	}

	private orderedBy(ordering: Comparator<T>): Collection<T> {
		return new Collection([...this.items].sort(ordering), ordering);
	}
}

export function collect<T>(items: readonly T[]): Collection<T> {
	return Collection.from(items);
}

function valueOf<T>(item: T, selector: Selector<T>): unknown {
	return typeof selector === 'function' ? selector(item) : item[selector];
}

function comparing<T>(key: OrderableKey<T>, direction: 1 | -1): Comparator<T> {
	return (a, b) => compareValues(a[key], b[key], direction);
}

function compareValues(a: unknown, b: unknown, direction: 1 | -1): number {
	const aMissing = isMissing(a);
	const bMissing = isMissing(b);
	if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;

	if (typeof a === 'string' && typeof b === 'string') return direction * Str.compare(a, b);
	if (typeof a === 'number' && typeof b === 'number') return direction * (a < b ? -1 : a > b ? 1 : 0);
	if (typeof a === 'boolean' && typeof b === 'boolean') return direction * (Number(a) - Number(b));

	throw new TypeError('Ordering requires values of the same scalar type');
}

function isMissing(value: unknown): boolean {
	return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}
