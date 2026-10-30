import { Str } from '@/utils/str';
import type { AttachmentKind } from '@/attachments/attachment-kind';
import type { LibraryItem, LibraryStatus } from '@/library/library-item';

export type KindFilter = AttachmentKind | 'all';
export type StatusFilter = LibraryStatus | 'all';

export interface LibraryQuery {
	query: string;
	kind: KindFilter;
}

export interface LibraryFilter extends LibraryQuery {
	status: StatusFilter;
}

export type StatusCounts = Record<StatusFilter, number>;

export function filterLibrary(items: LibraryItem[], { query, kind, status }: LibraryFilter): LibraryItem[] {
	return matching(items, { query, kind }).filter((item) => status === 'all' || item.status === status);
}

export function countByStatus(items: LibraryItem[], filter: LibraryQuery): StatusCounts {
	const counts: StatusCounts = { all: 0, used: 0, unused: 0, broken: 0 };

	for (const item of matching(items, filter)) {
		counts.all++;
		counts[item.status]++;
	}

	return counts;
}

export function adjacentItem(items: LibraryItem[], current: LibraryItem, offset: number): LibraryItem | undefined {
	const index = items.indexOf(current);

	return index === -1 ? undefined : items[index + offset];
}

function matching(items: LibraryItem[], { query, kind }: LibraryQuery): LibraryItem[] {
	const words = Str.words(query.toLowerCase());

	return items.filter((item) => {
		if (kind !== 'all' && item.kind !== kind) return false;
		if (words.length === 0) return true;

		const haystack = [item.key, ...item.notes].join('\n').toLowerCase();

		return words.every((word) => haystack.includes(word));
	});
}
