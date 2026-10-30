import type { UploadRegistry } from '@/uploads/upload-registry';

const STORE = 'uploads';

export class IndexedDbUploadRegistry implements UploadRegistry {
	private constructor(private readonly db: IDBDatabase) {}

	static async open(name: string, factory: IDBFactory = indexedDB): Promise<IndexedDbUploadRegistry> {
		const request = factory.open(name, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		return new IndexedDbUploadRegistry(await promisify(request));
	}

	async find(profile: string, hash: string): Promise<string | undefined> {
		return (await promisify(this.store('readonly').get(entryKey(profile, hash)))) as string | undefined;
	}

	async remember(profile: string, hash: string, key: string): Promise<void> {
		await promisify(this.store('readwrite').put(key, entryKey(profile, hash)));
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

function entryKey(profile: string, hash: string): string {
	return `${profile}\u0000${hash}`;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
