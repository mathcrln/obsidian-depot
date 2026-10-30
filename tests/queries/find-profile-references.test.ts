import type { App, TFile } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { findProfileReferences } from '@/queries/find-profile-references';

describe('findProfileReferences', () => {
	it('finds profile references in markdown and canvas files with a sample folder', async () => {
		const markdown = { path: 'notes/a.md', extension: 'md' } as TFile;
		const canvas = { path: 'board.canvas', extension: 'canvas' } as TFile;
		const ignored = { path: 'image.png', extension: 'png' } as TFile;
		const content = new Map<TFile, string>([
			[markdown, 'old://folder/one.png old://folder/two.png'],
			[canvas, '{"file":"old://other/image.png"}'],
			[ignored, 'old://ignored.png'],
		]);
		const app = {
			vault: {
				getFiles: () => [markdown, canvas, ignored],
				cachedRead: async (file: TFile) => content.get(file) ?? '',
			},
		} as unknown as App;

		const result = await findProfileReferences(app, 'old');

		expect(result).toEqual({
			affected: [
				{ file: markdown, count: 2 },
				{ file: canvas, count: 1 },
			],
			references: 3,
			sample: 'folder/…',
		});
	});

	it('returns no affected files when there are no references', async () => {
		const file = { path: 'notes/a.md', extension: 'md' } as TFile;
		const app = { vault: { getFiles: () => [file], cachedRead: async () => 'nothing here' } } as unknown as App;

		expect(await findProfileReferences(app, 'old')).toEqual({ affected: [], references: 0, sample: undefined });
	});
});
