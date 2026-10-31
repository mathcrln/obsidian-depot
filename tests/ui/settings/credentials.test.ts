import { expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { credentialSettings } from '@/ui/settings/credentials';
import { find, GivenSetting, WhenTyping } from '../../support/setup';

it('stores the trimmed credential in secret storage', () => {
	const profile = GivenProfile('personal');

	WhenEnteringCredential(profile, 'Access key ID', ' secret-value ');

	expect(profile.secrets).toEqual([{ id: 'depot-personal-access-key-id', value: 'secret-value' }]);
});

it('saves only the secret identifier in the plugin settings', () => {
	const profile = GivenProfile('personal');

	WhenEnteringCredential(profile, 'Access key ID', ' secret-value ');

	expect(profile.settings.profile('personal')?.accessKeySecret).toBe('depot-personal-access-key-id');
	expect(JSON.stringify(profile.settings.toJSON())).not.toContain('secret-value');
	expect(profile.save).toHaveBeenCalledOnce();
});

it('masks credential inputs', () => {
	const profile = GivenProfile('personal');

	const input = WhenShowingCredential(profile, 'Secret access key');

	expect(input.type).toBe('password');
});

function GivenProfile(id: string) {
	const settings = Settings.empty();
	settings.addProfile(id);
	const secrets: Array<{ id: string; value: string }> = [];
	const app = {
		secretStorage: {
			getSecret: () => null,
			setSecret: (secretId: string, value: string) => secrets.push({ id: secretId, value }),
		},
	} as unknown as App;
	const save = vi.fn(async () => {});

	return { id, app, settings, secrets, save, profiles: new Profiles({ app, settings, save }) };
}

function WhenShowingCredential(profile: ReturnType<typeof GivenProfile>, name: string): HTMLInputElement {
	const group = credentialSettings(profile.id, {
		app: profile.app,
		settings: () => profile.settings,
		profiles: profile.profiles,
		refresh: () => {},
	});

	return find<HTMLInputElement>(GivenSetting(group, name).controlEl, 'input');
}

function WhenEnteringCredential(profile: ReturnType<typeof GivenProfile>, name: string, value: string): void {
	WhenTyping(WhenShowingCredential(profile, name), value);
}
