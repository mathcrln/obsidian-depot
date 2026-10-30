import type { App, TFile } from 'obsidian';
import { rewriteReferences } from '@/references/rewrite-references';

export interface Affected {
	file: TFile;
	count: number;
}

export interface Found {
	affected: Affected[];
	references: number;
	/** A real key from a note, shortened to its folder, e.g. `2026/10/…`. */
	sample: string | undefined;
}

export interface Updated {
	references: number;
	notes: number;
	failed: number;
}

export async function findReferences(app: App, profileId: string): Promise<Found> {
	const { vault } = app;
	const files = vault.getFiles().filter((file) => file.extension === 'md' || file.extension === 'canvas');
	const keyPattern = new RegExp(`(?<![A-Za-z0-9+.-])${profileId}://([^\\s)\\]"'<>\`]+)`);
	const affected: Affected[] = [];
	let sample: string | undefined;

	for (const file of files) {
		const text = await vault.cachedRead(file);
		const { count } = rewriteReferences(text, profileId, profileId);

		if (count === 0) continue;

		affected.push({ file, count });
		sample ??= sampleOf(keyPattern.exec(text)?.[1]);
	}

	return { affected, references: affected.reduce((total, entry) => total + entry.count, 0), sample };
}

export async function updateReferences(
	app: App,
	affected: Affected[],
	from: string,
	to: string,
	onProgress: (done: number, total: number) => void = () => {}
): Promise<Updated> {
	const result: Updated = { references: 0, notes: 0, failed: 0 };

	for (const [index, { file, count }] of affected.entries()) {
		try {
			await app.vault.process(file, (data) => rewriteReferences(data, from, to).text);
			result.references += count;
			result.notes++;
		} catch {
			result.failed++;
		}

		onProgress(index + 1, affected.length);
	}

	return result;
}

export function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function sampleOf(key: string | undefined): string | undefined {
	if (key === undefined) return undefined;

	const slash = key.lastIndexOf('/');

	return slash === -1 ? undefined : `${key.slice(0, slash + 1)}…`;
}
