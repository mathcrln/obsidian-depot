import { Notice, type MarkdownView } from 'obsidian';
import type { Depot } from '@/depot';
import type { LibraryItem } from '@/library/library-item';
import { AttachmentReference } from '@/references/attachment-reference';

export function renderActions(
	parent: HTMLElement,
	depot: Depot,
	item: LibraryItem,
	lastEditor: () => MarkdownView | undefined
): void {
	const attachment = depot.attachments.of(AttachmentReference.to(item.profile, item.key));
	const actions = parent.createDiv({ cls: 'depot-library-actions' });

	actions.createEl('button', { text: 'Copy reference' }).addEventListener('click', () => {
		navigator.clipboard.writeText(attachment.reference.toString()).then(
			() => new Notice('Reference copied.'),
			() => new Notice('Could not copy the reference.')
		);
	});

	actions.createEl('button', { text: 'Insert into note', cls: 'mod-cta' }).addEventListener('click', () => {
		const editor = lastEditor();

		if (!editor) {
			new Notice('Open a note to insert into.');
			return;
		}

		editor.editor.replaceSelection(attachment.markdown());
	});
}
