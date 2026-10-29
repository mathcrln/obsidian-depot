import { describe, expect, it } from 'vitest';
import { InvalidProfileId, ProfileId } from '@/references/profile-id';

describe('ProfileId.parse', () => {
	it.each(['cosmos', 'r2', 'my-bucket-2', 'a'])('accepts %s', (value) => {
		expect(ProfileId.parse(value).value).toBe(value);
	});

	it.each([
		['empty', ''],
		['starting with a digit', '1cosmos'],
		['starting with a hyphen', '-cosmos'],
		['containing uppercase', 'Cosmos'],
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
		expect(ProfileId.isValid('cosmos')).toBe(true);
		expect(ProfileId.isValid('Cosmos')).toBe(false);
		expect(ProfileId.isValid('https')).toBe(false);
	});
});

describe('ProfileId value', () => {
	it('exposes its value as a string', () => {
		const id = ProfileId.parse('cosmos');

		expect(id.toString()).toBe('cosmos');
		expect(`${id}`).toBe('cosmos');
	});

	it('equals another id or string with the same value', () => {
		const id = ProfileId.parse('cosmos');

		expect(id.equals(ProfileId.parse('cosmos'))).toBe(true);
		expect(id.equals('cosmos')).toBe(true);
		expect(id.equals('other')).toBe(false);
		expect(id.equals(ProfileId.parse('other'))).toBe(false);
	});
});
