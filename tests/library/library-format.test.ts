import { describe, expect, it } from 'vitest';
import { extensionLabel, fileName, humanSize, tileTitle } from '@/library/library-format';

describe('humanSize', () => {
	it('formats bytes and larger units', () => {
		expect(humanSize(512)).toBe('512 B');
		expect(humanSize(1536)).toBe('1.5 KB');
		expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB');
		expect(humanSize(250 * 1024)).toBe('250 KB');
	});
});

describe('fileName and extensionLabel', () => {
	it('reads the last path segment and uppercased extension', () => {
		expect(fileName('2026/10/abc.png')).toBe('abc.png');
		expect(extensionLabel('2026/10/abc.png')).toBe('PNG');
		expect(extensionLabel('2026/README')).toBe('');
	});
});

describe('tileTitle', () => {
	it('joins name, size and date', () => {
		const title = tileTitle({ key: 'a/b.png', size: 2048, lastModified: new Date(2026, 9, 2).getTime() }, 'en-US');

		expect(title).toBe('b.png · 2.0 KB · Oct 2, 2026');
	});

	it('skips what is unknown', () => {
		expect(tileTitle({ key: 'a/b.png' }, 'en-US')).toBe('b.png');
	});
});
