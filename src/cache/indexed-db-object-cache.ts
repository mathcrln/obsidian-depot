import type { CachedObject, ObjectCache } from '@/cache/object-cache';

const STORE = 'objects';

export class IndexedDbObjectCache implements ObjectCache {
	private constructor(private readonly db: IDBDatabase) {}

	static async open(name: string, factory: IDBFactory = indexedDB): Promise<IndexedDbObjectCache> {
		const request = factory.open(name, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		return new IndexedDbObjectCache(await promisify(request));
	}

	async read(profile: string, key: string): Promise<CachedObject | undefined> {
		const store = this.store('readwrite');
		const found = (await promisify(store.get(entryKey(profile, key)))) as CachedObject | undefined;
		if (!found) return undefined;

		found.lastAccessed = Date.now();
		await promisify(store.put(found, entryKey(profile, key)));
		return found;
	}

	async write(profile: string, key: string, object: Omit<CachedObject, 'size' | 'lastAccessed'>): Promise<void> {
		const stored: CachedObject = { ...object, size: object.bytes.byteLength, lastAccessed: Date.now() };
		await promisify(this.store('readwrite').put(stored, entryKey(profile, key)));
	}

	async clear(): Promise<void> {
		await promisify(this.store('readwrite').clear());
	}

	close(): void {
		this.db.close();
	}

	private store(mode: IDBTransactionMode): IDBObjectStore {
		return this.db.transaction(STORE, mode).objectStore(STORE);
	}
}

function entryKey(profile: string, key: string): string {
	return `${profile}\u0000${key}`;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
