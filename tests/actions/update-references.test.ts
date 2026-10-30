import type { App, TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { updateReferences } from '@/actions/update-references';

describe('updateReferences', () => {
	it('rewrites files, counts references and reports progress after each file', async () => {
		const files = [{ path: 'a.md' }, { path: 'b.md' }] as TFile[];
		const writes: string[] = [];
		const progress = vi.fn();
		const app = {
			vault: {
				process: async (file: TFile, transform: (data: string) => string) => {
					writes.push(`${file.path}:${transform('old://x.png old://y.png')}`);
				},
			},
		} as unknown as App;

		const result = await updateReferences(
			app,
			files.map((file) => ({ file, count: 2 })),
			'old',
			'new',
			progress
		);

		expect(result).toEqual({ references: 4, notes: 2, failed: 0 });
		expect(writes).toEqual(['a.md:new://x.png new://y.png', 'b.md:new://x.png new://y.png']);
		expect(progress.mock.calls).toEqual([
			[1, 2],
			[2, 2],
		]);
	});

	it('counts failed files and continues processing later files', async () => {
		const files = [{ path: 'bad.md' }, { path: 'good.md' }] as TFile[];
		const progress = vi.fn();
		const app = {
			vault: {
				process: async (file: TFile) => {
					if (file.path === 'bad.md') throw new Error('read only');
				},
			},
		} as unknown as App;

		const result = await updateReferences(
			app,
			files.map((file) => ({ file, count: 1 })),
			'old',
			'new',
			progress
		);

		expect(result).toEqual({ references: 1, notes: 1, failed: 1 });
		expect(progress.mock.calls).toEqual([
			[1, 2],
			[2, 2],
		]);
	});
});
