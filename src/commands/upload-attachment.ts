import type DepotPlugin from '@/main';
import { uploadIntoEditor } from '@/editor/upload-into-editor';

export function registerUploadCommand(plugin: DepotPlugin): void {
	plugin.addCommand({
		id: 'upload-attachment',
		name: 'Upload attachment',
		editorCallback: (editor, ctx) => {
			const input = activeDocument.createElement('input');
			input.type = 'file';
			input.multiple = true;
			input.addEventListener('change', () => {
				void uploadIntoEditor(plugin.depot, editor, Array.from(input.files ?? []), ctx.file);
			});
			input.click();
		},
	});
}
