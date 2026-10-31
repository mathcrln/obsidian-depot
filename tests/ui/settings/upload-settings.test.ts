import { expect, it, vi } from 'vitest';
import type { Setting } from 'obsidian';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { uploadSettings } from '@/ui/settings/upload-settings';
import { find, GivenSetting, WhenTyping } from '../../support/setup';

it('previews the next upload path for the saved pattern', () => {
	const profile = GivenProfile();

	const setting = WhenShowingPathPattern(profile);

	expect(setting.descEl.textContent).toContain('Next upload:');
});

it('explains an invalid pattern without saving it', () => {
	const profile = GivenProfile();
	const original = profile.value.pathPattern;

	const setting = WhenEnteringPathPattern(profile, '{yyyy}/{name}');

	expect(setting.descEl.textContent).toContain('{id}');
	expect(setting.descEl.textContent).not.toContain('Next upload:');
	expect(profile.value.pathPattern).toBe(original);
	expect(profile.save).not.toHaveBeenCalled();
});

it('saves a valid pattern and previews it', () => {
	const profile = GivenProfile();

	const setting = WhenEnteringPathPattern(profile, '{yyyy}/{id}.{ext}');

	expect(setting.descEl.textContent).toContain('Next upload:');
	expect(setting.descEl.textContent).toContain('.jpg');
	expect(profile.value.pathPattern).toBe('{yyyy}/{id}.{ext}');
	expect(profile.save).toHaveBeenCalledOnce();
});

function GivenProfile() {
	const settings = Settings.empty();
	const value = settings.addProfile('personal');
	const save = vi.fn(async () => {});

	return { settings, value, save, profiles: new Profiles({ app: {} as never, settings, save }) };
}

function WhenShowingPathPattern(profile: ReturnType<typeof GivenProfile>): Setting {
	const group = uploadSettings(profile.value.id, { settings: () => profile.settings, profiles: profile.profiles });

	return GivenSetting(group, 'Path pattern');
}

function WhenEnteringPathPattern(profile: ReturnType<typeof GivenProfile>, pattern: string): Setting {
	const setting = WhenShowingPathPattern(profile);
	WhenTyping(find(setting.controlEl, 'input'), pattern);

	return setting;
}
