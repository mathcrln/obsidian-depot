import type DepotPlugin from '@/main';
import { uploadIntoEditor } from './upload-into-editor';

export function registerPasteAndDrop(plugin: DepotPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('editor-paste', (event, editor, info) => {
			const files = filesIn(event.clipboardData);
			if (event.defaultPrevented || files.length === 0) return;

			event.preventDefault();
			void uploadIntoEditor(plugin.depot, editor, files, info.file);
		})
	);

	plugin.registerEvent(
		plugin.app.workspace.on('editor-drop', (event, editor, info) => {
			const files = filesIn(event.dataTransfer);
			if (event.defaultPrevented || files.length === 0) return;

			event.preventDefault();
			void uploadIntoEditor(plugin.depot, editor, files, info.file);
		})
	);
}

function filesIn(transfer: DataTransfer | null): File[] {
	return transfer ? Array.from(transfer.files) : [];
}
