import { Notice, type Component, type MarkdownView } from 'obsidian';
import type { Depot } from '@/depot';
import type { LibraryItem } from '@/library/library-item';
import { AttachmentReference } from '@/references/attachment-reference';

export function renderActions(
	parent: HTMLElement,
	depot: Depot,
	item: LibraryItem,
	lastEditor: () => MarkdownView | undefined,
	owner: Component
): void {
	const attachment = depot.attachments.of(AttachmentReference.to(item.profile, item.key));
	const actions = parent.createDiv({ cls: 'depot-library-actions' });

	owner.registerDomEvent(actions.createEl('button', { text: 'Copy reference' }), 'click', () => {
		navigator.clipboard.writeText(attachment.reference.toString()).then(
			() => new Notice('Reference copied.'),
			() => new Notice('Could not copy the reference.')
		);
	});

	owner.registerDomEvent(actions.createEl('button', { text: 'Insert into note', cls: 'mod-cta' }), 'click', () => {
		const editor = lastEditor();

		if (!editor) {
			new Notice('Open a note to insert into.');
			return;
		}

		depot.notes.in(editor.editor).insert(attachment);
	});
}
