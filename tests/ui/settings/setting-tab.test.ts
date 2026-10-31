import { expect, it, vi } from 'vitest';
import type { SettingDefinitionItem } from 'obsidian';
import type DepotPlugin from '@/main';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { DepotSettingTab } from '@/ui/settings/setting-tab';

it('shows the default profile, the profiles, and the cache', () => {
	const tab = GivenSettingTab();

	const definitions = tab.value.getSettingDefinitions();

	expect(definitions.map(titleOf)).toEqual(['Default profile', 'Profiles', 'Cache']);
});

it('reads profile controls from the settings', () => {
	const tab = GivenSettingTab();

	expect(tab.value.getControlValue('profile.personal.region')).toBe('auto');
});

it('treats the only profile as the default', () => {
	const tab = GivenSettingTab();

	expect(tab.value.getControlValue('defaultProfile')).toBe('personal');
});

it('saves a trimmed profile control value', async () => {
	const tab = GivenSettingTab();

	await tab.value.setControlValue('profile.personal.bucket', '  media  ');

	expect(tab.settings.profile('personal')?.bucket).toBe('media');
	expect(tab.save).toHaveBeenCalledOnce();
});

function GivenSettingTab() {
	const settings = Settings.empty();
	settings.addProfile('personal');
	const save = vi.fn(async () => {});
	const app = { secretStorage: { getSecret: () => null } };
	const plugin = {
		app,
		manifest: { id: 'depot' },
		depot: {
			settings,
			profiles: new Profiles({ app: app as never, settings, save }),
			clearCache: async () => {},
		},
	};

	return { value: new DepotSettingTab(plugin as unknown as DepotPlugin), settings, save };
}

function titleOf(item: SettingDefinitionItem): string | undefined {
	if ('type' in item && (item.type === 'group' || item.type === 'list')) return item.heading;
	return 'name' in item ? item.name : undefined;
}
