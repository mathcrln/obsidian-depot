import type { App } from 'obsidian';
import type { Secrets } from '@/platform/secrets';

export function obsidianSecrets(app: App): Secrets {
	return {
		get: (id) => (id ? app.secretStorage.getSecret(id) : null),
	};
}
