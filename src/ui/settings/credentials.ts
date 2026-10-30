import type { App, Setting, SettingDefinition, SettingDefinitionItem } from 'obsidian';
import type { Profiles } from '@/actions/profiles';
import type { Settings } from '@/models/plugin-settings';

interface CredentialsHost {
	app: App;
	settings: () => Settings;
	profiles: Profiles;
	refresh: () => void;
}

export function credentialSettings(id: string, host: CredentialsHost): SettingDefinitionItem {
	return {
		type: 'group',
		heading: 'Credentials',
		items: [
			credential(id, 'Access key ID', 'accessKeySecret', `depot-${id}-access-key-id`, host),
			credential(id, 'Secret access key', 'secretKeySecret', `depot-${id}-secret-access-key`, host),
		],
	};
}

function credential(
	id: string,
	name: string,
	field: 'accessKeySecret' | 'secretKeySecret',
	fallbackSecretId: string,
	host: CredentialsHost
): SettingDefinition {
	return {
		name,
		desc: 'Kept in Obsidian secret storage, never in plugin settings.',
		render: (setting: Setting) => {
			const secretId = host.settings().profile(id)?.[field] || fallbackSecretId;
			const stored = hasSecret(secretId, host);

			setting.setName(name).setDesc('Kept in Obsidian secret storage, never in plugin settings.');
			setting.addText((text) => {
				text.inputEl.type = 'password';
				text.setPlaceholder(stored ? 'Stored — type to replace' : 'Not set').onChange((value) => {
					host.app.secretStorage.setSecret(secretId, value.trim());

					if (host.settings().profile(id) === undefined) return;

					void host.profiles.update(id, { [field]: secretId });
				});
				text.inputEl.addEventListener('change', () => {
					if (hasSecret(secretId, host) !== stored) host.refresh();
				});
			});
		},
	};
}

export function hasSecret(secretId: string, host: CredentialsHost): boolean {
	return secretId !== '' && Boolean(host.app.secretStorage.getSecret(secretId));
}
