import { describe, expect, it } from 'vitest';
import { InvalidProfileId, ProfileId } from '@/references/profile-id';

describe('ProfileId.parse', () => {
	it.each(['mybucket', 'r2', 'my-bucket-2', 'a'])('accepts %s', (value) => {
		expect(ProfileId.parse(value).value).toBe(value);
	});

	it.each([
		['empty', ''],
		['starting with a digit', '1mybucket'],
		['starting with a hyphen', '-mybucket'],
		['containing uppercase', 'Mybucket'],
		['containing an underscore', 'my_bucket'],
		['containing a space', 'my bucket'],
		['containing a dot', 'my.bucket'],
		['containing non-ASCII letters', 'café'],
	])('rejects an id %s', (_, value) => {
		expect(() => ProfileId.parse(value)).toThrow(InvalidProfileId);
	});

	it.each(['http', 'https', 'file', 'mailto', 'obsidian', 'app', 'data', 'blob', 'capacitor'])(
		'rejects reserved id %s',
		(value) => {
			expect(() => ProfileId.parse(value)).toThrow(InvalidProfileId);
		}
	);

	it('explains why an id is rejected', () => {
		expect(() => ProfileId.parse('https')).toThrow(/reserved/i);
		expect(() => ProfileId.parse('')).toThrow(/empty|start/i);
	});

	it('accepts ids that merely contain a reserved word', () => {
		expect(ProfileId.parse('https-store').value).toBe('https-store');
	});
});

describe('ProfileId.isValid', () => {
	it('tells valid from invalid ids', () => {
		expect(ProfileId.isValid('mybucket')).toBe(true);
		expect(ProfileId.isValid('Mybucket')).toBe(false);
		expect(ProfileId.isValid('https')).toBe(false);
	});
});

describe('ProfileId value', () => {
	it('exposes its value as a string', () => {
		const id = ProfileId.parse('mybucket');

		expect(id.toString()).toBe('mybucket');
		expect(`${id}`).toBe('mybucket');
	});

	it('equals another id or string with the same value', () => {
		const id = ProfileId.parse('mybucket');

		expect(id.equals(ProfileId.parse('mybucket'))).toBe(true);
		expect(id.equals('mybucket')).toBe(true);
		expect(id.equals('other')).toBe(false);
		expect(id.equals(ProfileId.parse('other'))).toBe(false);
	});
});
