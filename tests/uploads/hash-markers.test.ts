import { describe, expect, it } from 'vitest';
import { AccessDenied, ObjectNotFound, StorageUnreachable, type ObjectStore } from '@/storages/object-store';
import { HashMarkers } from '@/uploads/hash-markers';

describe('HashMarkers', () => {
	it('finds the key recorded for a hash', async () => {
		const markers = new HashMarkers(GivenStoreWithMarker('2026/10/a.png'));

		expect(await markers.find('abc')).toBe('2026/10/a.png');
	});

	it('treats a missing marker as unknown', async () => {
		expect(await new HashMarkers(GivenStoreFailingWith(new ObjectNotFound('x'))).find('abc')).toBeUndefined();
	});

	it('treats a denied marker lookup as unknown, as buckets without list access answer missing keys that way', async () => {
		expect(await new HashMarkers(GivenStoreFailingWith(new AccessDenied('x'))).find('abc')).toBeUndefined();
	});

	it('reports an unreachable storage', async () => {
		await expect(new HashMarkers(GivenStoreFailingWith(new StorageUnreachable('offline'))).find('abc')).rejects.toThrow(
			StorageUnreachable
		);
	});
});

function GivenStoreWithMarker(key: string): ObjectStore {
	return {
		put: async () => {},
		list: async function* () {},
		head: async () => ({ contentType: 'text/plain', size: key.length }),
		get: async () => ({ bytes: new TextEncoder().encode(key).buffer as ArrayBuffer, contentType: 'text/plain' }),
	};
}

function GivenStoreFailingWith(error: Error): ObjectStore {
	return {
		put: async () => {},
		list: async function* () {},
		head: async () => Promise.reject(error),
		get: async () => Promise.reject(error),
	};
}
