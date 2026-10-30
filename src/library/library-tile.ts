import type { Depot } from '@/depot';
import { fileName, tileTitle } from '@/library/library-format';
import type { LibraryGroup } from '@/library/library-groups';
import type { LibraryItem } from '@/library/library-item';
import { hasThumbnail, loadImage, renderPlaceholder } from '@/library/library-media';

export class LibraryGrid {
	private observer: IntersectionObserver | undefined;
	private readonly tiles = new Map<LibraryItem, HTMLElement>();
	private readonly images = new WeakMap<Element, LibraryItem>();

	constructor(
		private readonly parent: HTMLElement,
		private readonly depot: Depot,
		private readonly onSelect: (item: LibraryItem) => void,
		private readonly onOpen: (item: LibraryItem) => void
	) {}

	render(groups: LibraryGroup[], selected: LibraryItem | undefined): void {
		this.dispose();
		this.parent.empty();

		this.observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					this.observer?.unobserve(entry.target);
					const item = this.images.get(entry.target);
					if (item) loadImage(this.depot, item, entry.target as HTMLImageElement);
				}
			},
			{ rootMargin: '200px' }
		);

		for (const group of groups) {
			const section = this.parent.createEl('section', { cls: 'depot-library-section' });
			const header = section.createDiv({ cls: 'depot-library-section-header' });
			header.createSpan({ cls: 'depot-library-section-title', text: group.label });
			header.createSpan({ cls: 'depot-library-section-count', text: String(group.items.length) });
			const grid = section.createDiv({ cls: 'depot-library-grid' });
			for (const item of group.items) this.renderTile(grid, item, item === selected);
		}
	}

	select(item: LibraryItem | undefined): void {
		for (const [candidate, tile] of this.tiles) tile.toggleClass('is-selected', candidate === item);
	}

	dispose(): void {
		this.observer?.disconnect();
		this.observer = undefined;
		this.tiles.clear();
	}

	private renderTile(parent: HTMLElement, item: LibraryItem, selected: boolean): void {
		const title =
			item.status === 'used' ? tileTitle(item) : `${tileTitle(item)} · ${item.status === 'broken' ? 'Broken' : 'Unused'}`;
		const tile = parent.createDiv({
			cls: 'depot-library-tile',
			attr: {
				tabindex: '0',
				role: 'button',
				title,
				'aria-label': title,
				'data-status': item.status,
				'data-kind': item.kind,
			},
		});
		tile.toggleClass('is-selected', selected);
		tile.toggleClass('is-broken', item.status === 'broken');
		this.tiles.set(item, tile);

		if (hasThumbnail(item)) {
			const frame = tile.createDiv({ cls: 'depot-library-thumb depot-library-loading' });
			const img = frame.createEl('img', { cls: 'depot-library-img', attr: { alt: '' } });
			this.images.set(img, item);
			this.observer?.observe(img);
		} else {
			renderPlaceholder(tile, item);
			tile.createDiv({ cls: 'depot-library-name', text: fileName(item.key) });
		}

		if (item.status !== 'used')
			tile.createSpan({ cls: `depot-library-status is-${item.status}`, attr: { 'aria-hidden': 'true' } });

		tile.addEventListener('click', () => this.onSelect(item));
		tile.addEventListener('dblclick', () => this.onOpen(item));
		tile.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				this.onSelect(item);
				this.onOpen(item);
			} else if (event.key === ' ') {
				event.preventDefault();
				this.onSelect(item);
			}
		});
	}
}
