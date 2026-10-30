import { Notice, type Editor, type TFile } from 'obsidian';
import type { Depot } from '@/depot';

export async function uploadIntoEditor(depot: Depot, editor: Editor, files: File[], note?: TFile | null): Promise<void> {
	for (const file of files) {
		const notice = new Notice(`Uploading ${file.name}…`, 0);

		try {
			const { attachment, reused } = await depot.storages.default().upload(file, note ? { note: note.basename } : {});
			editor.replaceSelection(files.length > 1 ? `${attachment.markdown()}\n` : attachment.markdown());
			notice.hide();

			if (reused) {
				new Notice('Already uploaded — reused the existing file.');
			}
		} catch (error) {
			notice.hide();
			new Notice(`Could not upload ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
