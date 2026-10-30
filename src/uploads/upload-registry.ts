export interface UploadRegistry {
	find(profile: string, hash: string): Promise<string | undefined>;
	remember(profile: string, hash: string, key: string): Promise<void>;
	clear(): Promise<void>;
}
