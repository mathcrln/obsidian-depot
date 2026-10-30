import type { App, TFile } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';

describe('Profiles', () => {
	it('adds and persists a profile', async () => {
		const settings = Settings.empty();
		const saved: unknown[] = [];
		const profiles = GivenProfiles(settings, async () => {
			saved.push(settings.toJSON());
		});

		const profile = await profiles.add('personal');

		expect(profile.id).toBe('personal');
		expect(saved).toEqual([settings.toJSON()]);
	});

	it('renames while keeping references and persists the alias before returning', async () => {
		const settings = Settings.from({ profiles: [{ id: 'old' }] });
		const saved: unknown[] = [];
		const profiles = GivenProfiles(settings, async () => {
			saved.push(settings.toJSON());
		});

		const result = await profiles.rename('old', 'new', { references: 'keep' });

		expect(result).toEqual({ references: 0, notes: 0, failed: 0 });
		expect(settings.profile('new')?.aliases).toEqual(['old']);
		expect(saved).toHaveLength(1);
	});

	it('updates a default and profile fields through persisted capability methods', async () => {
		const settings = Settings.from({ profiles: [{ id: 'personal' }, { id: 'work' }] });
		const saved: unknown[] = [];
		const profiles = GivenProfiles(settings, async () => {
			saved.push(settings.toJSON());
		});

		await profiles.makeDefault('work');
		await profiles.update('personal', { bucket: 'media' });

		expect(settings.defaultProfile?.id).toBe('work');
		expect(settings.profile('personal')?.bucket).toBe('media');
		expect(saved).toHaveLength(2);
	});

	it('removes and persists the profile', async () => {
		const settings = Settings.from({ profiles: [{ id: 'personal' }] });
		const saved: unknown[] = [];
		const profiles = GivenProfiles(settings, async () => {
			saved.push(settings.toJSON());
		});

		await profiles.remove('personal');

		expect(settings.profile('personal')).toBeUndefined();
		expect(settings.isRetired('personal')).toBe(true);
		expect(saved).toHaveLength(1);
	});

	it('previews rename references from the bound vault', async () => {
		const file = { path: 'notes/a.md', extension: 'md' } as TFile;
		const app = { vault: { getFiles: () => [file], cachedRead: async () => 'old://folder/image.png' } } as unknown as App;
		const profiles = new Profiles({ app, settings: Settings.from({ profiles: [{ id: 'old' }] }), save: async () => {} });

		expect(await profiles.previewRename('old')).toMatchObject({ references: 1, sample: 'folder/…' });
	});

	it('updates previous references for aliases from settings', async () => {
		const file = { path: 'notes/a.md', extension: 'md' } as TFile;
		const contents = new Map<TFile, string>([[file, 'old://image.png']]);
		const settings = Settings.from({ profiles: [{ id: 'current', aliases: ['old'] }] });
		const saved: unknown[] = [];
		const app = {
			vault: {
				getFiles: () => [file],
				cachedRead: async (candidate: TFile) => contents.get(candidate) ?? '',
				process: async (candidate: TFile, transform: (data: string) => string) => {
					contents.set(candidate, transform(contents.get(candidate) ?? ''));
				},
			},
		} as unknown as App;
		const profiles = new Profiles({
			app,
			settings,
			save: async () => {
				saved.push(settings.toJSON());
			},
		});

		const result = await profiles.updatePreviousReferences('current');

		expect(result).toEqual({ references: 1, notes: 1, failed: 0, removedAliases: [] });
		expect(contents.get(file)).toBe('current://image.png');
		expect(settings.profile('current')?.aliases).toEqual([]);
		expect(saved).toHaveLength(1);
	});
});

function GivenProfiles(settings: Settings, save: () => Promise<void>): Profiles {
	return new Profiles({ app: {} as App, settings, save });
}
