import { expect, it } from 'vitest';
import type { App, SettingDefinitionPage, SettingGroupItem } from 'obsidian';
import { ProfilePages } from '@/ui/settings/profile-page';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';

it('names the page after the profile', () => {
	const profile = GivenProfile();

	const page = WhenShowingPage(profile);

	expect(page.type).toBe('page');
	expect(page.name).toBe('personal');
});

it('groups connection, credential, and upload settings', () => {
	const profile = GivenProfile();

	const page = WhenShowingPage(profile);

	expect(headingsOf(page)).toEqual(['Connection', 'Credentials', 'Uploads']);
	expect(settingsOf(page).map((item) => item.name)).toEqual([
		'Endpoint',
		'Bucket',
		'Region',
		'Path-style addressing',
		'Access key ID',
		'Secret access key',
		'Path pattern',
		'ID style',
		'Lowercase names',
		'Detect duplicates',
	]);
});

it('binds each control to a stable key', () => {
	const profile = GivenProfile();

	const page = WhenShowingPage(profile);

	expect(settingsOf(page).flatMap((item) => ('control' in item && item.control ? [item.control.key] : []))).toEqual([
		'profile.personal.endpoint',
		'profile.personal.bucket',
		'profile.personal.region',
		'profile.personal.forcePathStyle',
		'profile.personal.idStyle',
		'profile.personal.lowercaseNames',
		'profile.personal.detectDuplicates',
	]);
});

it('warns while the profile is incomplete', () => {
	const profile = GivenProfile();

	const page = WhenShowingPage(profile);

	expect(statusOf(page)).toBe('warning');
});

it('clears the warning once bucket and credentials are set', () => {
	const profile = GivenProfile();
	const page = WhenShowingPage(profile);

	WhenCompletingProfile(profile);

	expect(statusOf(page)).toBe(null);
});

function GivenProfile() {
	const settings = Settings.empty();
	const value = settings.addProfile('personal');
	const secrets = new Set<string>();
	const app = { secretStorage: { getSecret: (id: string) => (secrets.has(id) ? 'stored' : null) } } as unknown as App;

	return { settings, value, secrets, app };
}

function WhenShowingPage(profile: ReturnType<typeof GivenProfile>): SettingDefinitionPage {
	return new ProfilePages({
		app: profile.app,
		settings: () => profile.settings,
		profiles: new Profiles({ app: profile.app, settings: profile.settings, save: async () => {} }),
		rename: () => {},
		refresh: () => {},
	}).of(profile.value);
}

function WhenCompletingProfile(profile: ReturnType<typeof GivenProfile>): void {
	profile.settings.updateProfile('personal', { bucket: 'media', accessKeySecret: 'key-id', secretKeySecret: 'secret-id' });
	profile.secrets.add('key-id');
	profile.secrets.add('secret-id');
}

function headingsOf(page: SettingDefinitionPage): string[] {
	return (page.items ?? []).flatMap((item) => ('type' in item && item.type === 'group' ? [item.heading ?? ''] : []));
}

function settingsOf(page: SettingDefinitionPage): SettingGroupItem[] {
	return (page.items ?? []).flatMap((item) => ('type' in item && item.type === 'group' ? (item.items ?? []) : []));
}

function statusOf(page: SettingDefinitionPage): unknown {
	return typeof page.status === 'function' ? page.status() : page.status;
}
