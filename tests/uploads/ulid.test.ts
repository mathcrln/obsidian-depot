import { describe, expect, it } from 'vitest';
import { ulid } from '@/uploads/ulid';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('ulid', () => {
	it('creates a 26 character Crockford base32 identifier', () => {
		const id = ulid(1469918176385);

		expect(id).toHaveLength(26);
		expect(id).toMatch(CROCKFORD);
	});

	it('encodes the timestamp in the first ten characters', () => {
		expect(ulid(1469918176385).slice(0, 10)).toBe('01ARYZ6S41');
	});

	it('sorts lexicographically in time order', () => {
		const earlier = ulid(1700000000000);
		const later = ulid(1700000000001);
		const muchLater = ulid(1800000000000);

		expect([muchLater, earlier, later].sort()).toEqual([earlier, later, muchLater]);
	});

	it('creates different identifiers for the same time', () => {
		const time = 1700000000000;

		expect(ulid(time)).not.toBe(ulid(time));
	});

	it('defaults to the current time', () => {
		const before = Date.now();
		const prefix = ulid().slice(0, 10);
		const after = Date.now();

		expect(ulid(before).slice(0, 10) <= prefix).toBe(true);
		expect(prefix <= ulid(after).slice(0, 10)).toBe(true);
	});
});
