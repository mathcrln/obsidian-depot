import type { UploadRegistry } from '@/uploads/upload-registry';

export class MemoryUploadRegistry implements UploadRegistry {
	private readonly keys = new Map<string, string>();

	async find(profile: string, hash: string): Promise<string | undefined> {
		return this.keys.get(entryKey(profile, hash));
	}

	async remember(profile: string, hash: string, key: string): Promise<void> {
		this.keys.set(entryKey(profile, hash), key);
	}

	async clear(): Promise<void> {
		this.keys.clear();
	}
}

function entryKey(profile: string, hash: string): string {
	return `${profile}\u0000${hash}`;
}
