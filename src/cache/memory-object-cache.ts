import type { CachedObject, ObjectCache } from '@/cache/object-cache';

export class MemoryObjectCache implements ObjectCache {
	private readonly objects = new Map<string, CachedObject>();

	async read(profile: string, key: string): Promise<CachedObject | undefined> {
		const found = this.objects.get(entryKey(profile, key));
		if (!found) return undefined;

		found.lastAccessed = Date.now();
		return { ...found };
	}

	async write(profile: string, key: string, object: Omit<CachedObject, 'size' | 'lastAccessed'>): Promise<void> {
		this.objects.set(entryKey(profile, key), { ...object, size: object.bytes.byteLength, lastAccessed: Date.now() });
	}

	async clear(): Promise<void> {
		this.objects.clear();
	}
}

function entryKey(profile: string, key: string): string {
	return `${profile}\u0000${key}`;
}
