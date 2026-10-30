import { countByStatus, filterLibrary } from '@/library/library-filter';
import type { KindFilter, StatusCounts, StatusFilter } from '@/library/library-filter';
import type { LibraryItem } from '@/library/library-item';

export class LibraryViewState {
	profile: string | undefined;
	query = '';
	kind: KindFilter = 'all';
	status: StatusFilter = 'all';
	items: LibraryItem[] = [];
	visible: LibraryItem[] = [];
	counts: StatusCounts = { all: 0, used: 0, unused: 0, broken: 0 };
	selected: LibraryItem | undefined;

	setQuery(query: string): void {
		this.query = query;
		this.evaluate();
	}

	setKind(kind: KindFilter): void {
		this.kind = kind;
		this.evaluate();
	}

	setStatus(status: StatusFilter): void {
		this.status = status;
		this.evaluate();
	}

	setItems(items: LibraryItem[]): void {
		this.items = items;
		this.selected = undefined;
		this.evaluate();
	}

	select(item: LibraryItem | undefined): void {
		this.selected = item;
	}

	private evaluate(): void {
		this.counts = countByStatus(this.items, { query: this.query, kind: this.kind });
		if (this.items.length > 0 && this.status === 'broken' && this.counts.broken === 0) this.status = 'all';
		this.visible = filterLibrary(this.items, { query: this.query, kind: this.kind, status: this.status });
	}
}
