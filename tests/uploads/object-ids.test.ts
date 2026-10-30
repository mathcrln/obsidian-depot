import { describe, expect, it } from 'vitest';
import { ObjectId } from '@/uploads/object-ids';
import type { IdStyle } from '@/uploads/object-ids';

const HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{12}$/;

describe('hashing', () => {
	it('computes the SHA-256 of the bytes as lowercase hex', async () => {
		expect(await ObjectId.hashOf(GivenBytes('abc'))).toBe(HASH);
	});

	it('gives equal bytes the same hash and different bytes another one', async () => {
		const first = await ObjectId.hashOf(GivenBytes('same'));

		expect(await ObjectId.hashOf(GivenBytes('same'))).toBe(first);
		expect(await ObjectId.hashOf(GivenBytes('other'))).not.toBe(first);
	});
});

describe('content-hash', () => {
	it('is the first 32 hex characters of the hash', () => {
		expect(WhenGenerating('content-hash', { hash: HASH })).toBe('ba7816bf8f01cfea414140de5dae2223');
	});

	it('is the same for the same hash whatever the time', () => {
		expect(WhenGenerating('content-hash', { hash: HASH, time: 1 })).toBe(
			WhenGenerating('content-hash', { hash: HASH, time: 2 })
		);
	});

	it('differs for different hashes', () => {
		expect(WhenGenerating('content-hash', { hash: HASH })).not.toBe(WhenGenerating('content-hash', { hash: 'f'.repeat(64) }));
	});
});

describe('uuid-v4', () => {
	it('is a version 4 UUID with the RFC variant', () => {
		const match = UUID.exec(WhenGenerating('uuid-v4'));

		expect(match?.[1]).toBe('4');
		expect(match?.[2]).toMatch(/[89ab]/);
	});
});

describe('uuid-v7', () => {
	it('is a version 7 UUID with the RFC variant', () => {
		const match = UUID.exec(WhenGenerating('uuid-v7'));

		expect(match?.[1]).toBe('7');
		expect(match?.[2]).toMatch(/[89ab]/);
	});

	it('starts with the 48-bit millisecond timestamp', () => {
		const id = WhenGenerating('uuid-v7', { time: 0x0123456789ab });

		expect(id.replace('-', '').slice(0, 12)).toBe('0123456789ab');
	});

	it('sorts in time order', () => {
		const ids = [3000, 1000, 2000].map((time) => WhenGenerating('uuid-v7', { time }));

		expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
	});

	it('differs for the same time', () => {
		expect(WhenGenerating('uuid-v7', { time: 5 })).not.toBe(WhenGenerating('uuid-v7', { time: 5 }));
	});
});

describe('short', () => {
	it('is 10 base62 characters', () => {
		expect(WhenGenerating('short')).toMatch(/^[0-9A-Za-z]{10}$/);
	});

	it('uses the whole alphabet and differs between calls', () => {
		const ids = Array.from({ length: 300 }, () => WhenGenerating('short'));

		expect(new Set(ids).size).toBe(300);
		expect(new Set(ids.join('')).size).toBe(62);
	});
});

describe('ulid', () => {
	it('is a 26 character ULID carrying the time', () => {
		expect(WhenGenerating('ulid', { time: 1469918176385 })).toMatch(/^01ARYZ6S41[0-9A-HJKMNP-TV-Z]{16}$/);
	});
});

function WhenGenerating(style: IdStyle, { hash = HASH, time }: { hash?: string; time?: number } = {}): string {
	return ObjectId.generate(style, { hash, ...(time === undefined ? {} : { time }) });
}

function GivenBytes(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer as ArrayBuffer;
}
