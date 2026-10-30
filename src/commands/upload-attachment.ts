import type DepotPlugin from '@/main';
import { showUploadPicker } from '@/ui/notes/upload-picker';

export function registerUploadCommand(plugin: DepotPlugin): void {
	plugin.addCommand({
		id: 'upload-attachment',
		name: 'Upload attachment',
		editorCallback: (editor, ctx) => {
			showUploadPicker((files) => void plugin.depot.notes.in(editor, { file: ctx.file }).upload(files));
		},
	});
}
