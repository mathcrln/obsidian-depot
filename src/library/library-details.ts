import { Carbon } from '@/utils/carbon';
import type { App, MarkdownView } from 'obsidian';
import type { Depot } from '@/depot';
import { renderActions } from '@/library/library-actions';
import { extensionLabel, fileName, humanSize } from '@/library/library-format';
import type { LibraryItem } from '@/library/library-item';
import { hasThumbnail, loadImage, renderPlaceholder } from '@/library/library-media';

export function renderDetails(
	parent: HTMLElement,
	item: LibraryItem,
	app: App,
	depot: Depot,
	onClose: () => void,
	lastEditor: () => MarkdownView | undefined
): void {
	parent.empty();

	const header = parent.createDiv({ cls: 'depot-library-details-header' });
	header.createEl('h4', { text: fileName(item.key) });
	const close = header.createEl('button', { text: 'Close', cls: 'clickable-icon', attr: { 'aria-label': 'Close details' } });
	close.addEventListener('click', onClose);

	const preview = parent.createDiv({ cls: 'depot-library-preview' });
	if (hasThumbnail(item)) {
		loadImage(depot, item, preview.createEl('img', { cls: 'depot-library-img', attr: { alt: fileName(item.key) } }));
	} else {
		renderPlaceholder(preview, item);
	}

	const facts = parent.createEl('dl', { cls: 'depot-library-facts' });
	const fact = (term: string, value: string) => {
		facts.createEl('dt', { text: term });
		facts.createEl('dd', { text: value });
	};
	fact('Path', item.key);
	fact('Type', extensionLabel(item.key) || 'File');
	if (item.size !== undefined) fact('Size', humanSize(item.size));
	if (item.lastModified !== undefined) fact('Uploaded', Carbon.formatDate(item.lastModified));
	fact('Status', item.status === 'broken' ? 'Broken (object not found)' : item.status === 'used' ? 'Used' : 'Unused');

	parent.createEl('h5', { text: item.notes.length > 0 ? `Used in ${item.notes.length} note(s)` : 'Not used in any note' });
	const list = parent.createEl('ul', { cls: 'depot-library-notes' });
	for (const note of item.notes) {
		const link = list.createEl('li').createEl('a', { text: note, cls: 'internal-link' });
		link.addEventListener('click', (event) => {
			event.preventDefault();
			void app.workspace.openLinkText(note, '', false);
		});
	}

	renderActions(parent, depot, item, lastEditor);
}
