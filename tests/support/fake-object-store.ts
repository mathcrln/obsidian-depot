import { ObjectNotFound, StorageUnreachable } from '@/storages/object-store';
import type { ObjectMetadata, ObjectStore, StoredObject } from '@/storages/object-store';

export interface RecordedPut {
	key: string;
	bytes: ArrayBuffer;
	contentType: string;
}

export class FakeObjectStore implements ObjectStore {
	readonly puts: RecordedPut[] = [];
	private failure: Error | undefined;

	failWith(error: Error = new StorageUnreachable('offline')): void {
		this.failure = error;
	}

	async put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
		if (this.failure !== undefined) {
			throw this.failure;
		}

		this.puts.push({ key, bytes, contentType });
	}

	async get(key: string): Promise<StoredObject> {
		const put = this.find(key);

		return { bytes: put.bytes, contentType: put.contentType };
	}

	async head(key: string): Promise<ObjectMetadata> {
		const put = this.find(key);

		return { contentType: put.contentType, size: put.bytes.byteLength };
	}

	private find(key: string): RecordedPut {
		const put = this.puts.find((candidate) => candidate.key === key);

		if (put === undefined) {
			throw new ObjectNotFound(key);
		}

		return put;
	}
}
