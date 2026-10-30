import { describe, expect, it, vi } from 'vitest';
import type DepotPlugin from '@/main';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { DepotSettingTab } from '@/ui/settings/setting-tab';

vi.mock('obsidian', () => ({
	Notice: class Notice {},
	Modal: class Modal {},
	Setting: class Setting {},
	PluginSettingTab: class PluginSettingTab {
		constructor(
			readonly app: unknown,
			readonly plugin: unknown
		) {}
		update(): void {}
	},
}));

describe('DepotSettingTab', () => {
	it('keeps settings declarative and persists profile control updates', async () => {
		const settings = Settings.empty();
		settings.addProfile('personal');
		const saved: boolean[] = [];
		const app = { secretStorage: { getSecret: () => null } };
		const plugin = {
			app,
			manifest: { id: 'depot' },
			depot: {
				settings,
				profiles: new Profiles({
					app: app as never,
					settings,
					save: async () => {
						saved.push(true);
					},
				}),
				clearCache: async () => {},
			},
		};
		const tab = new DepotSettingTab(plugin as unknown as DepotPlugin);
		const definitions = tab.getSettingDefinitions();
		expect(tab.getControlValue('profile.personal.region')).toBe('auto');
		expect(tab.getControlValue('defaultProfile')).toBe('personal');

		expect(
			definitions.map((item) =>
				'type' in item && (item.type === 'group' || item.type === 'list')
					? item.heading
					: 'type' in item && item.type === 'page'
						? item.name
						: 'name' in item
							? item.name
							: undefined
			)
		).toEqual(['Default profile', 'Profiles', 'Cache']);

		await tab.setControlValue('profile.personal.bucket', '  media  ');

		expect(settings.profile('personal')?.bucket).toBe('media');
		expect(saved).toEqual([true]);
	});
});
