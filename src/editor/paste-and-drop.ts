import type DepotPlugin from '@/main';
import { uploadIntoEditor } from './upload-into-editor';

export function registerPasteAndDrop(plugin: DepotPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('editor-paste', (event, editor) => {
			const files = filesIn(event.clipboardData);
			if (event.defaultPrevented || files.length === 0) return;

			event.preventDefault();
			void uploadIntoEditor(plugin.depot, editor, files);
		})
	);

	plugin.registerEvent(
		plugin.app.workspace.on('editor-drop', (event, editor) => {
			const files = filesIn(event.dataTransfer);
			if (event.defaultPrevented || files.length === 0) return;

			event.preventDefault();
			void uploadIntoEditor(plugin.depot, editor, files);
		})
	);
}

function filesIn(transfer: DataTransfer | null): File[] {
	return transfer ? Array.from(transfer.files) : [];
}
