import { Carbon } from '@/utils/carbon';
import { Component, Modal, setIcon } from 'obsidian';
import type { App, MarkdownView } from 'obsidian';
import type { Depot } from '@/depot';
import { renderActions } from '@/ui/library/library-actions';
import { adjacentItem } from '@/library/library-filter';
import { fileName, humanSize } from '@/ui/library/library-format';
import type { LibraryItem } from '@/library/library-item';
import { hasThumbnail, loadImage, renderPlaceholder } from '@/ui/library/library-media';
import { AttachmentReference } from '@/references/attachment-reference';

export class LibraryLightbox extends Modal {
	private current: LibraryItem;
	private controlsScope: Component | undefined;
	private itemScope: Component | undefined;
	private stageEl: HTMLElement | undefined;
	private captionEl: HTMLElement | undefined;
	private actionsEl: HTMLElement | undefined;
	private previousEl: HTMLButtonElement | undefined;
	private nextEl: HTMLButtonElement | undefined;

	constructor(
		app: App,
		private readonly depot: Depot,
		private readonly items: LibraryItem[],
		start: LibraryItem,
		private readonly lastEditor: () => MarkdownView | undefined,
		private readonly onChange: (item: LibraryItem) => void,
		private readonly onDismiss: () => void
	) {
		super(app);
		this.current = start;
	}

	onOpen(): void {
		this.controlsScope?.unload();
		this.itemScope?.unload();
		const controlsScope = new Component();
		controlsScope.load();
		this.controlsScope = controlsScope;
		this.modalEl.addClass('depot-library-lightbox');
		this.titleEl.setText('');
		this.titleEl.addClass('is-hidden');

		const body = this.contentEl.createDiv({ cls: 'depot-library-lightbox-body' });
		this.previousEl = this.navButton(controlsScope, body, 'chevron-left', 'Previous file', -1);
		this.stageEl = body.createDiv({ cls: 'depot-library-lightbox-stage' });
		this.nextEl = this.navButton(controlsScope, body, 'chevron-right', 'Next file', 1);
		this.captionEl = this.contentEl.createDiv({ cls: 'depot-library-lightbox-caption' });
		this.actionsEl = this.contentEl.createDiv();
		const left = this.scope.register([], 'ArrowLeft', () => this.step(-1));
		const right = this.scope.register([], 'ArrowRight', () => this.step(1));
		controlsScope.register(() => this.scope.unregister(left));
		controlsScope.register(() => this.scope.unregister(right));

		this.show(this.current);
	}

	onClose(): void {
		this.controlsScope?.unload();
		this.controlsScope = undefined;
		this.itemScope?.unload();
		this.itemScope = undefined;
		this.stageEl = undefined;
		this.captionEl = undefined;
		this.actionsEl = undefined;
		this.previousEl = undefined;
		this.nextEl = undefined;
		this.contentEl.empty();
		this.onDismiss();
	}

	private navButton(scope: Component, parent: HTMLElement, icon: string, label: string, offset: number): HTMLButtonElement {
		const button = parent.createEl('button', {
			cls: 'depot-library-lightbox-nav clickable-icon',
			attr: { 'aria-label': label },
		});
		setIcon(button, icon);
		scope.registerDomEvent(button, 'click', () => this.step(offset));

		return button;
	}

	private step(offset: number): boolean {
		const next = adjacentItem(this.items, this.current, offset);
		if (next) this.show(next);

		return false;
	}

	private show(item: LibraryItem): void {
		const stageEl = this.stageEl;
		const captionEl = this.captionEl;
		const actionsEl = this.actionsEl;
		const previousEl = this.previousEl;
		const nextEl = this.nextEl;
		const controlsScope = this.controlsScope;
		if (!stageEl || !captionEl || !actionsEl || !previousEl || !nextEl || !controlsScope) return;
		this.itemScope?.unload();
		const itemScope = new Component();
		itemScope.load();
		this.itemScope = itemScope;

		this.current = item;
		this.onChange(item);
		previousEl.disabled = !adjacentItem(this.items, item, -1);
		nextEl.disabled = !adjacentItem(this.items, item, 1);

		stageEl.empty();
		if (hasThumbnail(item)) {
			const frame = stageEl.createDiv({ cls: 'depot-library-lightbox-frame' });
			loadImage(
				itemScope,
				this.depot,
				item,
				frame.createEl('img', { cls: 'depot-library-img', attr: { alt: fileName(item.key) } })
			);
		} else {
			renderPlaceholder(stageEl, item);
			if (item.status !== 'broken') this.renderOpen(itemScope, stageEl, item);
		}

		const position = `${this.items.indexOf(item) + 1} of ${this.items.length}`;
		const facts = [position];
		if (item.size !== undefined) facts.push(humanSize(item.size));
		if (item.lastModified !== undefined) facts.push(Carbon.formatDate(item.lastModified));
		captionEl.empty();
		captionEl.createDiv({ cls: 'depot-library-lightbox-name', text: fileName(item.key) });
		captionEl.createDiv({ cls: 'depot-library-lightbox-facts', text: facts.join(' · ') });

		actionsEl.empty();
		renderActions(actionsEl, this.depot, item, this.lastEditor, itemScope);
	}

	private renderOpen(scope: Component, parent: HTMLElement, item: LibraryItem): void {
		const open = parent.createEl('button', { text: 'Open' });
		scope.registerDomEvent(open, 'click', () => {
			void this.depot.attachments
				.of(AttachmentReference.to(item.profile, item.key))
				.resolve()
				.then(({ url }) => window.open(url));
		});
	}
}
