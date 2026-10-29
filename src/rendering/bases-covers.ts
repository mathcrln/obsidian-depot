import { TFile, type App } from 'obsidian';
import type { Attachment } from '@/attachments/attachment';
import type DepotPlugin from '@/main';

const PREFERRED_PROPERTIES = ['cover', 'image', 'banner', 'thumbnail'];

export function renderBasesCoversIn(root: HTMLElement, plugin: DepotPlugin): void {
	const covers = root.matches('.bases-cards-cover')
		? [root]
		: Array.from(root.querySelectorAll<HTMLElement>('.bases-cards-cover'));

	for (const cover of covers) {
		renderBasesCover(cover, plugin);
	}
}

function renderBasesCover(cover: HTMLElement, plugin: DepotPlugin): void {
	if (cover.style.backgroundImage && cover.dataset.depot !== 'loaded') return;

	const note = noteOfCard(cover, plugin.app);
	if (!note) {
		console.debug('[Depot] Bases cover: could not find the note for this card', cover.parentElement);
		return;
	}

	if (cover.dataset.depotNote === note.path) return;
	cover.dataset.depotNote = note.path;

	const attachment = coverOf(note, plugin);
	if (!attachment) {
		if (cover.dataset.depot === 'loaded') cover.style.backgroundImage = '';
		delete cover.dataset.depot;
		return;
	}

	cover.dataset.depot = 'loading';
	attachment.resolve().then(
		({ url }) => {
			if (cover.dataset.depotNote !== note.path) return;
			cover.style.backgroundImage = `url("${url}")`;
			cover.dataset.depot = 'loaded';
		},
		(error: unknown) => {
			cover.dataset.depot = 'failed';
			cover.addClass('depot-cover-failed');
			cover.setAttribute('aria-label', error instanceof Error ? error.message : String(error));
		}
	);
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

function coverOf(note: TFile, plugin: DepotPlugin): Attachment | undefined {
	const properties: Record<string, unknown> = plugin.app.metadataCache.getFileCache(note)?.frontmatter ?? {};
	const names = [...PREFERRED_PROPERTIES.filter((name) => name in properties), ...Object.keys(properties)];

	for (const name of names) {
		const image = plugin.depot.attachments.within(properties[name]).find((attachment) => attachment.kind === 'image');
		if (image) return image;
	}

	return undefined;
}
