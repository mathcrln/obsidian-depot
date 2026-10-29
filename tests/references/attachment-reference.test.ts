import { describe, expect, it } from 'vitest';
import { AttachmentReference, InvalidAttachmentReference } from '@/references/attachment-reference';
import { ProfileId } from '@/references/profile-id';

describe('AttachmentReference.parse', () => {
	it('splits profile and key', () => {
		const reference = AttachmentReference.parse('cosmos://photo.jpg');

		expect(reference.profile.value).toBe('cosmos');
		expect(reference.key).toBe('photo.jpg');
	});

	it('keeps nested paths in the key', () => {
		const reference = AttachmentReference.parse('cosmos://family/2024/photo.jpg');

		expect(reference.profile.value).toBe('cosmos');
		expect(reference.key).toBe('family/2024/photo.jpg');
	});

	it('decodes percent-encoded keys', () => {
		expect(AttachmentReference.parse('cosmos://my%20photos/caf%C3%A9%20(1).jpg').key).toBe('my photos/café (1).jpg');
	});

	it.each([
		['an uppercase scheme', 'Cosmos://a.jpg'],
		['a reserved scheme', 'https://example.com/x.jpg'],
		['a missing separator', 'cosmos:a.jpg'],
		['a plain vault path', 'images/a.png'],
		['an empty key', 'cosmos://'],
		['a leading slash', 'cosmos:///a.jpg'],
		['an empty scheme', '://a.jpg'],
		['an invalid scheme', '1cosmos://a.jpg'],
		['a truncated percent escape', 'cosmos://a%2'],
		['an invalid percent escape', 'cosmos://a%zz.jpg'],
		['an invalid UTF-8 escape', 'cosmos://a%FF.jpg'],
		['an empty string', ''],
	])('rejects %s', (_, value) => {
		expect(() => AttachmentReference.parse(value)).toThrow(InvalidAttachmentReference);
		expect(AttachmentReference.tryParse(value)).toBeUndefined();
	});
});

describe('AttachmentReference.tryParse', () => {
	it('returns the reference when valid', () => {
		expect(AttachmentReference.tryParse('cosmos://a/b.png')?.key).toBe('a/b.png');
	});

	it.each(['https://example.com/x.jpg', 'images/a.png', 'mailto:me@example.com'])('returns undefined for %s', (value) => {
		expect(AttachmentReference.tryParse(value)).toBeUndefined();
	});
});

describe('AttachmentReference.to', () => {
	it('builds a reference from a profile id and a raw key', () => {
		const reference = AttachmentReference.to(ProfileId.parse('cosmos'), 'family/photo.jpg');

		expect(reference.toString()).toBe('cosmos://family/photo.jpg');
	});

	it('accepts a profile given as a string', () => {
		expect(AttachmentReference.to('cosmos', 'a.jpg').profile.value).toBe('cosmos');
	});

	it('rejects an invalid profile', () => {
		expect(() => AttachmentReference.to('https', 'a.jpg')).toThrow();
	});

	it.each(['', '/a.jpg'])('rejects the key "%s"', (key) => {
		expect(() => AttachmentReference.to('cosmos', key)).toThrow(InvalidAttachmentReference);
	});

	it('encodes characters that break a Markdown link destination', () => {
		const text = AttachmentReference.to('cosmos', 'a b/(c)<d>#e?f%g.jpg').toString();

		expect(text).toBe('cosmos://a%20b/%28c%29%3Cd%3E%23e%3Ff%25g.jpg');
		expect(text).not.toMatch(/[\s()<>]/);
	});
});

describe('AttachmentReference round trip', () => {
	it.each([
		'photo.jpg',
		'my photos/holiday 2024.jpg',
		'café/résumé.pdf',
		'日本語/写真.png',
		'a (1)/b (2).png',
		'notes #1/what?.png',
		'100%/done%20.png',
		'emoji/😀.png',
		"it's/a~b*c!.png",
	])('keeps the key %s', (key) => {
		const reference = AttachmentReference.parse(AttachmentReference.to('cosmos', key).toString());

		expect(reference.key).toBe(key);
		expect(reference.profile.value).toBe('cosmos');
	});
});

describe('AttachmentReference equality', () => {
	it('equals a reference with the same profile and key', () => {
		const reference = AttachmentReference.parse('cosmos://a/b.png');

		expect(reference.equals(AttachmentReference.to('cosmos', 'a/b.png'))).toBe(true);
		expect(reference.equals(AttachmentReference.parse('cosmos://a/c.png'))).toBe(false);
		expect(reference.equals(AttachmentReference.parse('other://a/b.png'))).toBe(false);
	});
});
