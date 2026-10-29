export interface StoredObject {
	bytes: ArrayBuffer;
	contentType: string;
	etag?: string;
}

export interface ObjectMetadata {
	contentType: string;
	size: number;
	etag?: string;
}

export interface ObjectStore {
	put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
	get(key: string): Promise<StoredObject>;
	head(key: string): Promise<ObjectMetadata>;
}

export class StorageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class ObjectNotFound extends StorageError {
	constructor(key: string) {
		super(`Object not found: ${key}`);
	}
}

export class AccessDenied extends StorageError {
	constructor(key: string) {
		super(`Access denied: ${key}`);
	}
}

export class StorageUnreachable extends StorageError {
	constructor(reason: string) {
		super(`Storage unreachable: ${reason}`);
	}
}

export class MissingCredentials extends StorageError {
	constructor(profile: string) {
		super(`Missing credentials for profile "${profile}"`);
	}
}
