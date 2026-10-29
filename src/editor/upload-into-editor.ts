import { Notice, type Editor } from 'obsidian';
import type { Depot } from '@/depot';

export async function uploadIntoEditor(depot: Depot, editor: Editor, files: File[]): Promise<void> {
	for (const file of files) {
		const notice = new Notice(`Uploading ${file.name}…`, 0);

		try {
			const attachment = await depot.storages.default().upload(file);
			editor.replaceSelection(files.length > 1 ? `${attachment.markdown()}\n` : attachment.markdown());
			notice.hide();
		} catch (error) {
			notice.hide();
			new Notice(`Could not upload ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
