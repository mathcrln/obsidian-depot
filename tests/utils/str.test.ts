import { describe, expect, it } from 'vitest';
import { Str } from '@/utils/str';

describe('Str', () => {
	describe('slug', () => {
		it.each([
			['Beach Photo (2)', 'beach-photo-2'],
			['  --weird__name!!  ', 'weird-name'],
			['a   b---c', 'a-b-c'],
			['ÉTÉ à Paris', 'été-à-paris'],
			['日本語 ファイル', '日本語-ファイル'],
			['a/b\\c', 'a-b-c'],
			['***', ''],
			['', ''],
		])('slugs %j to %j', (value, expected) => {
			expect(Str.slug(value)).toBe(expected);
		});

		it('preserves case when requested', () => {
			expect(Str.slug('ÉTÉ My NOTE', { lowercase: false })).toBe('ÉTÉ-My-NOTE');
		});
	});

	describe('escapeRegExp', () => {
		it.each(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'])(
			'escapes the metacharacter %s',
			(character) => {
				const pattern = new RegExp('^' + Str.escapeRegExp(character) + '$');

				expect(pattern.test(character)).toBe(true);
				expect(pattern.test('other')).toBe(false);
			}
		);

		it('leaves ordinary text and hyphens unchanged', () => {
			expect(Str.escapeRegExp('my-profile/été')).toBe('my-profile/été');
			expect(Str.escapeRegExp('')).toBe('');
		});
	});

	describe('words', () => {
		it('splits whitespace and preserves word case and punctuation', () => {
			expect(Str.words('  My\tphoto.jpg\n summer  ')).toEqual(['My', 'photo.jpg', 'summer']);
		});

		it.each(['', ' \t\n '])('returns no words for %j', (value) => {
			expect(Str.words(value)).toEqual([]);
		});
	});

	describe('compare', () => {
		it.each([
			['a', 'b', -1],
			['b', 'a', 1],
			['same', 'same', 0],
			['Z', 'a', -1],
			['z', 'é', -1],
			['', 'a', -1],
		])('compares %j with %j in ordinal order', (a, b, expected) => {
			expect(Str.compare(a, b)).toBe(expected);
		});
	});

	describe('plural', () => {
		it.each([
			[0, 'notes'],
			[1, 'note'],
			[2, 'notes'],
		])('uses English pluralization for %i', (count, expected) => {
			expect(Str.plural('note', count)).toBe(expected);
		});

		it.each([
			[0, 'jour'],
			[1, 'jour'],
			[2, 'jours'],
		])('uses explicit French pluralization for %i', (count, expected) => {
			expect(Str.plural('jour', count, { locale: 'fr' })).toBe(expected);
		});

		it('uses the supplied plural only when plural', () => {
			expect(Str.plural('œil', 2, { locale: 'fr', plural: 'yeux' })).toBe('yeux');
			expect(Str.plural('œil', 1, { locale: 'fr', plural: 'yeux' })).toBe('œil');
		});
	});

	describe('quantity', () => {
		it.each([
			[0, '0 notes'],
			[1, '1 note'],
			[3, '3 notes'],
		])('prefixes the count for %i', (count, expected) => {
			expect(Str.quantity(count, 'note')).toBe(expected);
		});

		it('supports explicit locale and irregular plural options', () => {
			expect(Str.quantity(0, 'jour', { locale: 'fr' })).toBe('0 jour');
			expect(Str.quantity(2, 'œil', { locale: 'fr', plural: 'yeux' })).toBe('2 yeux');
		});
	});
});
