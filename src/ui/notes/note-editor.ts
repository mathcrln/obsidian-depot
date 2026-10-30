import { Notice, type Editor } from 'obsidian';
import { uploadAttachments, type UploadFile } from '@/actions/upload-attachments';
import type { UploadableFile } from '@/storages/profile';

export interface InsertableAttachment {
	markdown(): string;
}

export class NoteEditor {
	constructor(
		private readonly editor: Pick<Editor, 'replaceSelection'>,
		private readonly uploadFile: UploadFile<InsertableAttachment>,
		private readonly note?: string
	) {}

	insert(attachment: InsertableAttachment): void {
		this.editor.replaceSelection(attachment.markdown());
	}

	async upload(files: readonly UploadableFile[]): Promise<void> {
		let notice: Notice | undefined;
		const context = this.note === undefined ? {} : { note: this.note };

		for await (const event of uploadAttachments({ files, upload: this.uploadFile, context })) {
			if (event.type === 'started') {
				notice = new Notice(`Uploading ${event.file.name}…`, 0);
				continue;
			}

			if (event.type === 'failed') {
				notice?.hide();
				showFailure(event.file.name, event.error);
				continue;
			}

			try {
				this.editor.replaceSelection(`${event.attachment.markdown()}${files.length > 1 ? '\n' : ''}`);
				notice?.hide();
				if (event.reused) new Notice('Already uploaded — reused the existing file.');
			} catch (error) {
				notice?.hide();
				showFailure(event.file.name, error);
			}
		}
	}
}

function showFailure(fileName: string, error: unknown): void {
	new Notice(`Could not upload ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
}
