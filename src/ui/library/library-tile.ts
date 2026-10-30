import { Component } from 'obsidian';
import type { Depot } from '@/depot';
import { fileName, tileTitle } from '@/ui/library/library-format';
import type { LibraryGroup } from '@/library/library-groups';
import type { LibraryItem } from '@/library/library-item';
import { hasThumbnail, loadImage, renderPlaceholder } from '@/ui/library/library-media';

export class LibraryGrid extends Component {
	private observer: IntersectionObserver | undefined;
	private readonly tiles = new Map<LibraryItem, HTMLElement>();
	private readonly images = new WeakMap<Element, LibraryItem>();
	private renderScope: Component | undefined;

	constructor(
		private readonly parent: HTMLElement,
		private readonly depot: Depot,
		private readonly onSelect: (item: LibraryItem) => void,
		private readonly onOpen: (item: LibraryItem) => void
	) {
		super();
	}

	render(groups: LibraryGroup[], selected: LibraryItem | undefined): void {
		this.dispose();
		this.parent.empty();
		const scope = this.addChild(new Component());
		this.renderScope = scope;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					observer.unobserve(entry.target);
					const item = this.images.get(entry.target);
					if (item) loadImage(scope, this.depot, item, entry.target as HTMLImageElement);
				}
			},
			{ rootMargin: '200px' }
		);
		this.observer = observer;
		scope.register(() => {
			observer.disconnect();
			this.observer = undefined;
		});

		for (const group of groups) {
			const section = this.parent.createEl('section', { cls: 'depot-library-section' });
			const header = section.createDiv({ cls: 'depot-library-section-header' });
			header.createSpan({ cls: 'depot-library-section-title', text: group.label });
			header.createSpan({ cls: 'depot-library-section-count', text: String(group.items.length) });
			const grid = section.createDiv({ cls: 'depot-library-grid' });
			for (const item of group.items) this.renderTile(scope, grid, item, item === selected);
		}
	}

	select(item: LibraryItem | undefined): void {
		for (const [candidate, tile] of this.tiles) tile.toggleClass('is-selected', candidate === item);
	}

	dispose(): void {
		if (this.renderScope !== undefined) this.removeChild(this.renderScope);
		this.renderScope = undefined;
		this.tiles.clear();
	}

	onunload(): void {
		this.dispose();
	}

	private renderTile(scope: Component, parent: HTMLElement, item: LibraryItem, selected: boolean): void {
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
			scope.register(() => this.images.delete(img));
			this.observer?.observe(img);
		} else {
			renderPlaceholder(tile, item);
			tile.createDiv({ cls: 'depot-library-name', text: fileName(item.key) });
		}

		if (item.status !== 'used')
			tile.createSpan({ cls: `depot-library-status is-${item.status}`, attr: { 'aria-hidden': 'true' } });

		scope.registerDomEvent(tile, 'click', () => this.onSelect(item));
		scope.registerDomEvent(tile, 'dblclick', () => this.onOpen(item));
		scope.registerDomEvent(tile, 'keydown', (event) => {
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
