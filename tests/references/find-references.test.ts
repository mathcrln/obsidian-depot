import { describe, expect, it } from 'vitest';
import { findReferencesIn } from '@/references/find-references';

describe('findReferencesIn', () => {
	it('finds a markdown embed', () => {
		expect(findReferencesIn('![alt](main://a/b.png)')).toEqual(['main://a/b.png']);
	});

	it('finds a markdown link with a title', () => {
		expect(findReferencesIn('[doc](main://a.pdf "Title")')).toEqual(['main://a.pdf']);
	});

	it('finds an angle-bracket destination containing spaces up to the first space', () => {
		expect(findReferencesIn('![x](<main://a b.png>)')).toEqual(['main://a']);
	});

	it('finds an angle-bracket destination without spaces', () => {
		expect(findReferencesIn('![x](<main://a.png>)')).toEqual(['main://a.png']);
	});

	it('finds a frontmatter value', () => {
		expect(findReferencesIn('---\ncover: main://cover.jpg\n---\nbody')).toEqual(['main://cover.jpg']);
	});

	it('finds quoted values in canvas json', () => {
		expect(findReferencesIn('{"type":"file","file":"main://x.png","other":"main://y.png"}')).toEqual([
			'main://x.png',
			'main://y.png',
		]);
	});

	it('finds a wikilink target and stops at the alias separator', () => {
		expect(findReferencesIn('![[main://a.png|200]]')).toEqual(['main://a.png']);
	});

	it('finds bare text and stops at a comma', () => {
		expect(findReferencesIn('see main://a.png, then main://b.png')).toEqual(['main://a.png', 'main://b.png']);
	});

	it('keeps duplicates in order', () => {
		expect(findReferencesIn('main://a.png other://b.png main://a.png')).toEqual([
			'main://a.png',
			'other://b.png',
			'main://a.png',
		]);
	});

	it('accepts digits and hyphens in the scheme', () => {
		expect(findReferencesIn('my-bucket2://k.png')).toEqual(['my-bucket2://k.png']);
	});

	it('ignores a scheme preceded by a scheme character', () => {
		expect(findReferencesIn('x+main://a.png a.main://b.png 1main://c.png')).toEqual([]);
	});

	it('finds a scheme preceded by punctuation', () => {
		expect(findReferencesIn('(main://a.png) "main://b.png" [main://c.png]')).toEqual([
			'main://a.png',
			'main://b.png',
			'main://c.png',
		]);
	});

	it('returns nothing for text without references', () => {
		expect(findReferencesIn('plain text :// nothing')).toEqual([]);
	});
});
