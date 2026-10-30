import { expect, it, vi } from 'vitest';
import type { App, Setting, SettingGroup } from 'obsidian';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { credentialSettings } from '@/ui/settings/credentials';

vi.mock('obsidian', () => ({}));

it('stores credential values in secret storage and persists only their identifiers', () => {
	const settings = Settings.empty();
	settings.addProfile('personal');
	const stored: Array<{ id: string; value: string }> = [];
	const app = {
		secretStorage: {
			getSecret: () => null,
			setSecret: (id: string, value: string) => stored.push({ id, value }),
		},
	} as unknown as App;
	const save = vi.fn(async () => {});
	const profiles = new Profiles({ app, settings, save });
	const group = credentialSettings('personal', { app, settings: () => settings, profiles, refresh: () => {} });
	const field = 'type' in group && group.type === 'group' ? group.items?.[0] : undefined;
	const setting = new FakeSetting();

	if (field === undefined || !('render' in field) || field.render === undefined)
		throw new Error('Credential field is missing.');
	field.render(setting as unknown as Setting, {} as SettingGroup);
	setting.change?.(' secret-value ');

	expect(stored).toEqual([{ id: 'depot-personal-access-key-id', value: 'secret-value' }]);
	expect(settings.profile('personal')?.accessKeySecret).toBe('depot-personal-access-key-id');
	expect(JSON.stringify(settings.toJSON())).not.toContain('secret-value');
	expect(save).toHaveBeenCalledOnce();
});

class FakeSetting {
	change: ((value: string) => void) | undefined;
	setName(): this {
		return this;
	}
	setDesc(): this {
		return this;
	}
	addText(configure: (text: FakeText) => void): this {
		const text = new FakeText();
		configure(text);
		this.change = text.change;
		return this;
	}
}

class FakeText {
	inputEl = { type: '', addEventListener: () => {} };
	change: ((value: string) => void) | undefined;
	setPlaceholder(): this {
		return this;
	}
	onChange(callback: (value: string) => void): this {
		this.change = callback;
		return this;
	}
}
