import type { App, SettingDefinitionPage } from 'obsidian';
import type { Profiles } from '@/actions/profiles';
import type { ProfileSettings, Settings } from '@/models/plugin-settings';
import { connectionSettings } from '@/ui/settings/connection-settings';
import { credentialSettings, hasSecret } from '@/ui/settings/credentials';
import { profileNameSettings } from '@/ui/settings/profile-names';
import { uploadSettings } from '@/ui/settings/upload-settings';

export interface ProfilePagesHost {
	app: App;
	settings: () => Settings;
	profiles: Profiles;
	rename: (id: string) => void;
	refresh: () => void;
}

export class ProfilePages {
	constructor(private readonly host: ProfilePagesHost) {}

	private get settings(): Settings {
		return this.host.settings();
	}

	of(profile: ProfileSettings): SettingDefinitionPage {
		const id = profile.id;

		return {
			type: 'page',
			name: id,
			displayValue: () => this.settings.profile(id)?.bucket || 'Not configured',
			status: () => {
				const current = this.settings.profile(id);

				return current === undefined ||
					current.bucket === '' ||
					!hasSecret(current.accessKeySecret, this.host) ||
					!hasSecret(current.secretKeySecret, this.host)
					? 'warning'
					: null;
			},
			items: [
				...profileNameSettings(id, this.host),
				connectionSettings(id),
				credentialSettings(id, this.host),
				uploadSettings(id, this.host),
			],
		};
	}
}
