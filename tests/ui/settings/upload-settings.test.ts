import { afterEach, expect, it, vi } from 'vitest';
import type { Setting, SettingGroup } from 'obsidian';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { uploadSettings } from '@/ui/settings/upload-settings';

vi.mock('obsidian', () => ({}));
afterEach(() => vi.unstubAllGlobals());

it('previews invalid path patterns without saving and persists valid patterns', () => {
	const settings = Settings.empty();
	const profile = settings.addProfile('personal');
	const originalPattern = profile.pathPattern;
	const save = vi.fn(async () => {});
	const group = uploadSettings('personal', {
		settings: () => settings,
		profiles: new Profiles({ app: {} as never, settings, save }),
	});
	const definition = 'type' in group && group.type === 'group' ? group.items?.[0] : undefined;
	const setting = new FakeSetting();
	const line = new FakeLine();
	vi.stubGlobal('createFragment', () => ({ createDiv: () => line, prepend: () => {} }));

	if (definition === undefined || !('render' in definition) || definition.render === undefined) {
		throw new Error('Path pattern setting is missing.');
	}
	definition.render(setting as unknown as Setting, {} as SettingGroup);

	expect(line.text).toContain('Next upload:');
	setting.change?.('{yyyy}/{name}');
	expect(line.text).toContain('{id}');
	expect(profile.pathPattern).toBe(originalPattern);
	expect(save).not.toHaveBeenCalled();

	setting.change?.('{yyyy}/{id}.{ext}');
	expect(line.text).toContain('Next upload:');
	expect(line.text).toContain('.jpg');
	expect(profile.pathPattern).toBe('{yyyy}/{id}.{ext}');
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
	setValue(): this {
		return this;
	}
	onChange(callback: (value: string) => void): this {
		this.change = callback;
		return this;
	}
}

class FakeLine {
	text = '';
	setText(text: string): this {
		this.text = text;
		return this;
	}
	removeClass(): this {
		return this;
	}
	addClass(): this {
		return this;
	}
}
