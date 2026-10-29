export interface CachedObject {
	bytes: ArrayBuffer;
	contentType: string;
	etag?: string;
	size: number;
	lastAccessed: number;
}

export interface ObjectCache {
	read(profile: string, key: string): Promise<CachedObject | undefined>;
	write(profile: string, key: string, object: Omit<CachedObject, 'size' | 'lastAccessed'>): Promise<void>;
	clear(): Promise<void>;
}
