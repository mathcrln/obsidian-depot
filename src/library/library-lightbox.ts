import { Modal, setIcon, type App, type MarkdownView } from 'obsidian';
import type { Depot } from '@/depot';
import { renderActions } from '@/library/library-actions';
import { adjacentItem } from '@/library/library-filter';
import { fileName, formatDate, humanSize } from '@/library/library-format';
import type { LibraryItem } from '@/library/library-item';
import { hasThumbnail, loadImage, renderPlaceholder } from '@/library/library-media';
import { AttachmentReference } from '@/references/attachment-reference';

export class LibraryLightbox extends Modal {
	private current: LibraryItem;
	private stageEl!: HTMLElement;
	private captionEl!: HTMLElement;
	private actionsEl!: HTMLElement;
	private previousEl!: HTMLButtonElement;
	private nextEl!: HTMLButtonElement;

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
		this.modalEl.addClass('depot-library-lightbox');
		this.titleEl.setText('');
		this.titleEl.addClass('is-hidden');

		const body = this.contentEl.createDiv({ cls: 'depot-library-lightbox-body' });
		this.previousEl = this.navButton(body, 'chevron-left', 'Previous file', -1);
		this.stageEl = body.createDiv({ cls: 'depot-library-lightbox-stage' });
		this.nextEl = this.navButton(body, 'chevron-right', 'Next file', 1);
		this.captionEl = this.contentEl.createDiv({ cls: 'depot-library-lightbox-caption' });
		this.actionsEl = this.contentEl.createDiv();

		this.scope.register([], 'ArrowLeft', () => this.step(-1));
		this.scope.register([], 'ArrowRight', () => this.step(1));

		this.show(this.current);
	}

	onClose(): void {
		this.contentEl.empty();
		this.onDismiss();
	}

	private navButton(parent: HTMLElement, icon: string, label: string, offset: number): HTMLButtonElement {
		const button = parent.createEl('button', {
			cls: 'depot-library-lightbox-nav clickable-icon',
			attr: { 'aria-label': label },
		});
		setIcon(button, icon);
		button.addEventListener('click', () => this.step(offset));

		return button;
	}

	private step(offset: number): boolean {
		const next = adjacentItem(this.items, this.current, offset);
		if (next) this.show(next);

		return false;
	}

	private show(item: LibraryItem): void {
		this.current = item;
		this.onChange(item);
		this.previousEl.disabled = !adjacentItem(this.items, item, -1);
		this.nextEl.disabled = !adjacentItem(this.items, item, 1);

		this.stageEl.empty();
		if (hasThumbnail(item)) {
			const frame = this.stageEl.createDiv({ cls: 'depot-library-lightbox-frame' });
			loadImage(this.depot, item, frame.createEl('img', { cls: 'depot-library-img', attr: { alt: fileName(item.key) } }));
		} else {
			renderPlaceholder(this.stageEl, item);
			if (item.status !== 'broken') this.renderOpen(item);
		}

		const position = `${this.items.indexOf(item) + 1} of ${this.items.length}`;
		const facts = [position];
		if (item.size !== undefined) facts.push(humanSize(item.size));
		if (item.lastModified !== undefined) facts.push(formatDate(item.lastModified));
		this.captionEl.empty();
		this.captionEl.createDiv({ cls: 'depot-library-lightbox-name', text: fileName(item.key) });
		this.captionEl.createDiv({ cls: 'depot-library-lightbox-facts', text: facts.join(' · ') });

		this.actionsEl.empty();
		renderActions(this.actionsEl, this.depot, item, this.lastEditor);
	}

	private renderOpen(item: LibraryItem): void {
		const open = this.stageEl.createEl('button', { text: 'Open' });
		open.addEventListener('click', () => {
			void this.depot.attachments
				.of(AttachmentReference.to(item.profile, item.key))
				.resolve()
				.then(({ url }) => window.open(url));
		});
	}
}
