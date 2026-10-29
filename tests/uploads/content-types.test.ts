import { describe, expect, it } from 'vitest';
import { contentTypeOf } from '@/uploads/content-types';

describe('contentTypeOf', () => {
	it('prefers a reported content type', () => {
		expect(contentTypeOf('photo.png', 'image/heic')).toBe('image/heic');
	});

	it('ignores an empty reported content type', () => {
		expect(contentTypeOf('photo.png', '')).toBe('image/png');
	});

	it('infers the content type from the extension when none is reported', () => {
		expect(contentTypeOf('photo.png')).toBe('image/png');
		expect(contentTypeOf('photo.jpg')).toBe('image/jpeg');
		expect(contentTypeOf('photo.jpeg')).toBe('image/jpeg');
		expect(contentTypeOf('document.pdf')).toBe('application/pdf');
		expect(contentTypeOf('song.mp3')).toBe('audio/mpeg');
		expect(contentTypeOf('clip.mp4')).toBe('video/mp4');
		expect(contentTypeOf('notes.md')).toBe('text/markdown');
		expect(contentTypeOf('data.json')).toBe('application/json');
		expect(contentTypeOf('table.csv')).toBe('text/csv');
		expect(contentTypeOf('bundle.zip')).toBe('application/zip');
	});

	it('matches the extension case-insensitively', () => {
		expect(contentTypeOf('PHOTO.PNG')).toBe('image/png');
	});

	it('falls back to octet-stream for unknown or missing extensions', () => {
		expect(contentTypeOf('archive.xyz')).toBe('application/octet-stream');
		expect(contentTypeOf('README')).toBe('application/octet-stream');
	});
});
