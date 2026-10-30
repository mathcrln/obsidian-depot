import type { Editor, TFile } from 'obsidian';
import type { UploadFile } from '@/actions/upload-attachments';
import { NoteEditor, type InsertableAttachment } from '@/ui/notes/note-editor';

export class Notes {
	constructor(private readonly upload: UploadFile<InsertableAttachment>) {}

	in(editor: Pick<Editor, 'replaceSelection'>, { file }: { file?: Pick<TFile, 'basename'> | null } = {}): NoteEditor {
		return new NoteEditor(editor, this.upload, file?.basename);
	}
}
