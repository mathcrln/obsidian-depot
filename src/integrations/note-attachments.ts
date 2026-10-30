import { Component, type Plugin } from 'obsidian';
import type { Depot } from '@/depot';
import type { WorkspaceObserver } from '@/integrations/workspace-observer';
import { renderAttachmentsIn } from '@/ui/notes/attachment-element';

export class NoteAttachments extends Component {
	constructor(
		private readonly plugin: Plugin,
		private readonly depot: Depot,
		private readonly observer: WorkspaceObserver
	) {
		super();
	}

	onload(): void {
		this.registerPasteAndDrop();
		this.registerReadingView();
		this.registerLivePreview();
	}

	private registerPasteAndDrop(): void {
		this.registerEvent(
			this.plugin.app.workspace.on('editor-paste', (event, editor, info) => {
				const files = filesIn(event.clipboardData);
				if (event.defaultPrevented || files.length === 0) return;

				event.preventDefault();
				void this.depot.notes.in(editor, { file: info.file }).upload(files);
			})
		);

		this.registerEvent(
			this.plugin.app.workspace.on('editor-drop', (event, editor, info) => {
				const files = filesIn(event.dataTransfer);
				if (event.defaultPrevented || files.length === 0) return;

				event.preventDefault();
				void this.depot.notes.in(editor, { file: info.file }).upload(files);
			})
		);
	}

	private registerReadingView(): void {
		this.plugin.registerMarkdownPostProcessor((element) => renderAttachmentsIn(element, this.depot));
	}

	private registerLivePreview(): void {
		this.register(this.observer.subscribe((element) => renderAttachmentsIn(element, this.depot)));
	}
}

function filesIn(transfer: DataTransfer | null): File[] {
	return transfer ? Array.from(transfer.files) : [];
}
