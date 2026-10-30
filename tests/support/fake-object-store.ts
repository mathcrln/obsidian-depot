import { ObjectNotFound, StorageUnreachable } from '@/storages/object-store';
import type { ObjectMetadata, ObjectStore, ObjectSummary, StoredObject } from '@/storages/object-store';

export interface RecordedPut {
	key: string;
	bytes: ArrayBuffer;
	contentType: string;
	lastModified: number;
}

export class FakeObjectStore implements ObjectStore {
	readonly puts: RecordedPut[] = [];
	readonly gets: string[] = [];
	private failure: Error | undefined;

	constructor(private readonly clock: () => number = () => 0) {}

	failWith(error: Error = new StorageUnreachable('offline')): void {
		this.failure = error;
	}

	async put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
		if (this.failure !== undefined) {
			throw this.failure;
		}

		this.remove(key);
		this.puts.push({ key, bytes, contentType, lastModified: this.clock() });
	}

	remove(key: string): void {
		const index = this.puts.findIndex((candidate) => candidate.key === key);

		if (index >= 0) {
			this.puts.splice(index, 1);
		}
	}

	async get(key: string): Promise<StoredObject> {
		this.gets.push(key);
		const put = this.find(key);

		return { bytes: put.bytes, contentType: put.contentType };
	}

	async head(key: string): Promise<ObjectMetadata> {
		const put = this.find(key);

		return { contentType: put.contentType, size: put.bytes.byteLength };
	}

	async *list(prefix = ''): AsyncGenerator<ObjectSummary> {
		if (this.failure !== undefined) {
			throw this.failure;
		}

		for (const put of this.puts) {
			if (put.key.startsWith(prefix)) {
				yield { key: put.key, size: put.bytes.byteLength, lastModified: put.lastModified };
			}
		}
	}

	private find(key: string): RecordedPut {
		const put = this.puts.find((candidate) => candidate.key === key);

		if (put === undefined) {
			throw new ObjectNotFound(key);
		}

		return put;
	}
}
