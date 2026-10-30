import { AccessDenied, ObjectNotFound } from '@/storages/object-store';
import type { ObjectStore } from '@/storages/object-store';

/** Buckets that don't grant list access answer a missing key with 403 instead of 404. */
export function looksMissing(error: unknown): boolean {
	return error instanceof ObjectNotFound || error instanceof AccessDenied;
}

const PREFIX = '.depot/hashes/';

export class HashMarkers {
	constructor(private readonly store: ObjectStore) {}

	static keyFor(hash: string): string {
		return `${PREFIX}${hash}`;
	}

	async find(hash: string): Promise<string | undefined> {
		try {
			const { bytes } = await this.store.get(HashMarkers.keyFor(hash));
			const key = new TextDecoder().decode(bytes).trim();

			return key === '' ? undefined : key;
		} catch (error) {
			if (looksMissing(error)) return undefined;

			throw error;
		}
	}

	async record(hash: string, key: string): Promise<void> {
		await this.store.put(HashMarkers.keyFor(hash), new TextEncoder().encode(key).buffer, 'text/plain');
	}
}
