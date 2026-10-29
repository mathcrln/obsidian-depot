import { describe, expect, it } from 'vitest';
import { attachmentKindOf } from '@/attachments/attachment-kind';

describe('attachmentKindOf', () => {
	it.each(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'heic'])(
		'classifies .%s as image',
		(extension) => {
			expect(attachmentKindOf(`attachments/01ABC.${extension}`)).toBe('image');
		}
	);

	it.each(['mp3', 'm4a', 'wav', 'ogg', 'flac'])('classifies .%s as audio', (extension) => {
		expect(attachmentKindOf(`attachments/01ABC.${extension}`)).toBe('audio');
	});

	it.each(['mp4', 'mov', 'webm', 'mkv'])('classifies .%s as video', (extension) => {
		expect(attachmentKindOf(`attachments/01ABC.${extension}`)).toBe('video');
	});

	it('classifies pdf', () => {
		expect(attachmentKindOf('attachments/01ABC.pdf')).toBe('pdf');
	});

	it('matches the extension case-insensitively', () => {
		expect(attachmentKindOf('attachments/01ABC.PNG')).toBe('image');
		expect(attachmentKindOf('attachments/01ABC.Pdf')).toBe('pdf');
	});

	it('classifies other or missing extensions as other', () => {
		expect(attachmentKindOf('attachments/01ABC.zip')).toBe('other');
		expect(attachmentKindOf('attachments/01ABC.md')).toBe('other');
		expect(attachmentKindOf('attachments/01ABC')).toBe('other');
	});

	it('uses only the final extension', () => {
		expect(attachmentKindOf('attachments/01ABC.png.zip')).toBe('other');
	});
});
