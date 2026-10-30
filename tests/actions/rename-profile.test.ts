import type { App, TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { renameProfile } from '@/actions/rename-profile';
import { Settings } from '@/models/plugin-settings';

describe('renameProfile', () => {
	it('renames and persists without updating note references', async () => {
		const settings = Settings.from({ profiles: [{ id: 'old' }] });
		const events: string[] = [];
		const app = {} as App;
		const save = vi.fn(async () => {
			events.push('save');
		});

		const result = await renameProfile({
			app,
			settings,
			save,
			from: 'old',
			to: 'new',
			references: 'keep',
		});

		expect(result).toEqual({ references: 0, notes: 0, failed: 0 });
		expect(settings.profile('new')?.aliases).toEqual(['old']);
		expect(save).toHaveBeenCalledTimes(1);
		expect(events).toEqual(['save']);
	});

	it('updates references and removes the old alias only after all files succeed', async () => {
		const files = [{ path: 'one.md' }, { path: 'two.md' }] as TFile[];
		const settings = Settings.from({ profiles: [{ id: 'old' }] });
		const events: string[] = [];
		const contents = new Map<TFile, string>([
			[files[0]!, 'old://one.png old://two.png'],
			[files[1]!, 'old://three.png'],
		]);
		const save = vi.fn(async () => {
			events.push(`save:${settings.profile('new')?.aliases.join(',')}`);
		});
		const progress = vi.fn();
		const app = {
			vault: {
				process: async (file: TFile, transform: (data: string) => string) => {
					events.push(`write:${file.path}:${settings.profile('new')?.aliases.join(',')}`);
					contents.set(file, transform(contents.get(file) ?? ''));
				},
			},
		} as unknown as App;

		const result = await renameProfile({
			app,
			settings,
			save,
			from: 'old',
			to: 'new',
			references: 'update',
			affected: [
				{ file: files[0]!, count: 2 },
				{ file: files[1]!, count: 1 },
			],
			onProgress: progress,
		});

		expect(result).toEqual({ references: 3, notes: 2, failed: 0 });
		expect(settings.profile('new')?.aliases).toEqual([]);
		expect(save).toHaveBeenCalledTimes(2);
		expect(contents.get(files[0]!)).toBe('new://one.png new://two.png');
		expect(contents.get(files[1]!)).toBe('new://three.png');
		expect(events).toEqual(['save:old', 'write:one.md:old', 'write:two.md:old', 'save:']);
		expect(progress.mock.calls).toEqual([
			[1, 2],
			[2, 2],
		]);
	});

	it('keeps the alias when a later file fails, even after earlier files were rewritten', async () => {
		const files = [{ path: 'first.md' }, { path: 'second.md' }] as TFile[];
		const settings = Settings.from({ profiles: [{ id: 'old' }] });
		const contents = new Map<TFile, string>([
			[files[0]!, 'old://one.png old://two.png'],
			[files[1]!, 'old://three.png'],
		]);
		const app = {
			vault: {
				process: async (file: TFile, transform: (data: string) => string) => {
					if (file === files[1]) throw new Error('read only');
					contents.set(file, transform(contents.get(file) ?? ''));
				},
			},
		} as unknown as App;
		const save = vi.fn(async () => {});

		const result = await renameProfile({
			app,
			settings,
			save,
			from: 'old',
			to: 'new',
			references: 'update',
			affected: [
				{ file: files[0]!, count: 2 },
				{ file: files[1]!, count: 1 },
			],
		});

		expect(result).toEqual({ references: 2, notes: 1, failed: 1 });
		expect(settings.profile('new')?.aliases).toEqual(['old']);
		expect(contents.get(files[0]!)).toBe('new://one.png new://two.png');
		expect(contents.get(files[1]!)).toBe('old://three.png');
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('does not change note references when saving the rename fails', async () => {
		const file = { path: 'note.md' } as TFile;
		const contents = new Map<TFile, string>([[file, 'old://image.png']]);
		const settings = Settings.from({ profiles: [{ id: 'old' }] });
		const save = vi.fn(async () => {
			throw new Error('storage unavailable');
		});
		const process = vi.fn(async (candidate: TFile, transform: (data: string) => string) => {
			contents.set(candidate, transform(contents.get(candidate) ?? ''));
		});
		const app = { vault: { process } } as unknown as App;

		await expect(
			renameProfile({
				app,
				settings,
				save,
				from: 'old',
				to: 'new',
				references: 'update',
				affected: [{ file, count: 1 }],
			})
		).rejects.toThrow('storage unavailable');

		expect(settings.profile('new')?.aliases).toEqual(['old']);
		expect(contents.get(file)).toBe('old://image.png');
		expect(process).not.toHaveBeenCalled();
		expect(save).toHaveBeenCalledOnce();
	});
});
