export function showUploadPicker(onSelect: (files: File[]) => void): void {
	const input = activeWindow.document.body.createEl('input');
	input.type = 'file';
	input.multiple = true;
	input.addEventListener('change', () => onSelect(Array.from(input.files ?? [])), { once: true });
	input.click();
	input.detach();
}
