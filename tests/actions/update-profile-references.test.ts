import type { App, TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { updatePreviousReferences } from '@/actions/update-profile-references';
import { Settings } from '@/models/plugin-settings';

describe('updatePreviousReferences', () => {
	it('updates each alias and removes aliases with no references', async () => {
		const file = { path: 'note.md', extension: 'md' } as TFile;
		const contents = new Map<TFile, string>([[file, 'legacy://image.png']]);
		const settings = Settings.from({ profiles: [{ id: 'current', aliases: ['legacy', 'unused'] }] });
		const save = vi.fn(async () => {});
		const app = {
			vault: {
				getFiles: () => [file],
				cachedRead: async (candidate: TFile) => contents.get(candidate) ?? '',
				process: async (candidate: TFile, transform: (data: string) => string) => {
					contents.set(candidate, transform(contents.get(candidate) ?? ''));
				},
			},
		} as unknown as App;

		const result = await updatePreviousReferences({
			app,
			settings,
			profileId: 'current',
			aliases: ['legacy', 'unused'],
			save,
		});

		expect(result).toEqual({ references: 1, notes: 1, failed: 0, removedAliases: ['unused'] });
		expect(contents.get(file)).toBe('current://image.png');
		expect(settings.profile('current')?.aliases).toEqual([]);
		expect(save).toHaveBeenCalledOnce();
	});

	it('retains aliases whose reference updates fail', async () => {
		const file = { path: 'note.md', extension: 'md' } as TFile;
		const settings = Settings.from({ profiles: [{ id: 'current', aliases: ['legacy'] }] });
		const save = vi.fn(async () => {});
		const app = {
			vault: {
				getFiles: () => [file],
				cachedRead: async () => 'legacy://image.png',
				process: async () => {
					throw new Error('read only');
				},
			},
		} as unknown as App;

		const result = await updatePreviousReferences({ app, settings, profileId: 'current', aliases: ['legacy'], save });

		expect(result).toEqual({ references: 0, notes: 0, failed: 1, removedAliases: [] });
		expect(settings.profile('current')?.aliases).toEqual(['legacy']);
		expect(save).toHaveBeenCalledOnce();
	});

	it('removes a successfully updated alias while retaining a different alias that fails', async () => {
		const good = { path: 'good.md', extension: 'md' } as TFile;
		const bad = { path: 'bad.md', extension: 'md' } as TFile;
		const contents = new Map<TFile, string>([
			[good, 'old-good://one.png'],
			[bad, 'old-bad://two.png'],
		]);
		const settings = Settings.from({ profiles: [{ id: 'current', aliases: ['old-good', 'old-bad'] }] });
		const save = vi.fn(async () => {});
		const app = {
			vault: {
				getFiles: () => [good, bad],
				cachedRead: async (file: TFile) => contents.get(file) ?? '',
				process: async (file: TFile, transform: (data: string) => string) => {
					if (file === bad) throw new Error('read only');
					contents.set(file, transform(contents.get(file) ?? ''));
				},
			},
		} as unknown as App;

		const result = await updatePreviousReferences({
			app,
			settings,
			profileId: 'current',
			aliases: ['old-good', 'old-bad'],
			save,
		});

		expect(result).toEqual({ references: 1, notes: 1, failed: 1, removedAliases: [] });
		expect(contents.get(good)).toBe('current://one.png');
		expect(contents.get(bad)).toBe('old-bad://two.png');
		expect(settings.profile('current')?.aliases).toEqual(['old-bad']);
		expect(save).toHaveBeenCalledOnce();
	});
});
