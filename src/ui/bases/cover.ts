import { TFile, type App } from 'obsidian';
import type { Attachment } from '@/attachments/attachment';
import type { Depot } from '@/depot';

const PREFERRED_PROPERTIES = ['cover', 'image', 'banner', 'thumbnail'];

export class BasesCoverRenderer {
	private readonly requests = new WeakMap<HTMLElement, number>();
	private readonly pending = new Map<HTMLElement, { request: number; notePath: string }>();

	constructor(
		private readonly app: App,
		private readonly depot: Depot,
		private readonly isActive: () => boolean
	) {}

	render(root: HTMLElement): void {
		const covers = root.matches('.bases-cards-cover')
			? [root]
			: Array.from(root.querySelectorAll<HTMLElement>('.bases-cards-cover'));

		for (const cover of covers) this.renderCover(cover);
	}

	stop(): void {
		for (const [cover, { request, notePath }] of this.pending) {
			if (
				this.requests.get(cover) === request &&
				cover.dataset.depotNote === notePath &&
				cover.dataset.depot === 'loading'
			) {
				delete cover.dataset.depot;
				delete cover.dataset.depotNote;
			}
		}
		this.pending.clear();
	}

	private renderCover(cover: HTMLElement): void {
		if (cover.style.backgroundImage && cover.dataset.depot !== 'loaded') return;

		const note = noteOfCard(cover, this.app);
		if (!note) {
			console.debug('[Depot] Bases cover: could not find the note for this card', cover.parentElement);
			return;
		}

		if (cover.dataset.depotNote === note.path) return;
		cover.dataset.depotNote = note.path;
		const request = (this.requests.get(cover) ?? 0) + 1;
		this.requests.set(cover, request);
		const isCurrent = () => this.isActive() && this.requests.get(cover) === request;

		const attachment = coverOf(note, this.app, this.depot);
		if (!attachment) {
			if (cover.dataset.depot === 'loaded') cover.style.removeProperty('background-image');
			delete cover.dataset.depot;
			return;
		}

		cover.dataset.depot = 'loading';
		this.pending.set(cover, { request, notePath: note.path });
		const finish = () => {
			if (this.pending.get(cover)?.request === request) this.pending.delete(cover);
		};
		attachment.resolve().then(
			({ url }) => {
				finish();
				if (!isCurrent()) return;
				cover.style.backgroundImage = `url("${url}")`;
				cover.dataset.depot = 'loaded';
			},
			(error: unknown) => {
				finish();
				if (!isCurrent()) return;
				cover.dataset.depot = 'failed';
				cover.addClass('depot-cover-failed');
				cover.setAttribute('aria-label', error instanceof Error ? error.message : String(error));
			}
		);
	}
}

function noteOfCard(cover: HTMLElement, app: App): TFile | null {
	const card = cover.closest<HTMLElement>('.bases-cards-item') ?? cover.parentElement;
	if (!card) return null;

	const candidates = [
		card.getAttribute('data-path'),
		card.querySelector('[data-path]')?.getAttribute('data-path'),
		card.querySelector('[data-href]')?.getAttribute('data-href'),
		card.innerText
			.split('\n')
			.find((line) => line.trim())
			?.trim(),
	];

	for (const candidate of candidates) {
		if (!candidate) continue;

		const file = app.vault.getAbstractFileByPath(candidate) ?? app.metadataCache.getFirstLinkpathDest(candidate, '');
		if (file instanceof TFile) return file;
	}

	return null;
}

function coverOf(note: TFile, app: App, depot: Depot): Attachment | undefined {
	const properties: Record<string, unknown> = app.metadataCache.getFileCache(note)?.frontmatter ?? {};
	const names = [...PREFERRED_PROPERTIES.filter((name) => name in properties), ...Object.keys(properties)];

	for (const name of names) {
		const image = depot.attachments.within(properties[name]).find((attachment) => attachment.kind === 'image');
		if (image) return image;
	}

	return undefined;
}
