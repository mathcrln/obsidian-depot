import type { App } from 'obsidian';
import type { Secrets } from '@/settings/secrets';

export function obsidianSecrets(app: App): Secrets {
	return {
		get: (id) => (id ? app.secretStorage.getSecret(id) : null),
	};
}
