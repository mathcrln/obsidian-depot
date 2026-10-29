import { describe, expect, it } from 'vitest';
import { objectKeyFor } from '@/uploads/object-keys';

const TIME = 1469918176385;
const PREFIX = '01ARYZ6S41';

describe('objectKeyFor', () => {
	it('places the file under attachments with a time-ordered ULID and its extension', () => {
		const key = objectKeyFor('photo.png', TIME);

		expect(key).toMatch(/^attachments\/[0-9A-Z]{26}\.png$/);
		expect(key.startsWith(`attachments/${PREFIX}`)).toBe(true);
	});

	it('lowercases the extension', () => {
		expect(objectKeyFor('PHOTO.JPG', TIME)).toMatch(/^attachments\/[0-9A-Z]{26}\.jpg$/);
	});

	it('keeps only the last extension of a multi-dot name', () => {
		expect(objectKeyFor('archive.tar.gz', TIME)).toMatch(/^attachments\/[0-9A-Z]{26}\.gz$/);
	});

	it('uses no extension for a file without one', () => {
		expect(objectKeyFor('README', TIME)).toMatch(/^attachments\/[0-9A-Z]{26}$/);
	});

	it('treats a leading-dot name as having no extension', () => {
		expect(objectKeyFor('.hidden', TIME)).toMatch(/^attachments\/[0-9A-Z]{26}$/);
	});

	it('uses the extension of a dotfile-like name that also has an extension', () => {
		expect(objectKeyFor('.config.json', TIME)).toMatch(/^attachments\/[0-9A-Z]{26}\.json$/);
	});

	it('uses no extension for a trailing dot', () => {
		expect(objectKeyFor('name.', TIME)).toMatch(/^attachments\/[0-9A-Z]{26}$/);
	});

	it('defaults the time to now', () => {
		const before = objectKeyFor('x', Date.now());
		const key = objectKeyFor('photo.png');
		const after = objectKeyFor('x', Date.now());

		expect(key).toMatch(/^attachments\/[0-9A-Z]{26}\.png$/);
		expect(key.slice(12, 22) >= before.slice(12, 22)).toBe(true);
		expect(key.slice(12, 22) <= after.slice(12, 22)).toBe(true);
	});
});
