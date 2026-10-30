import type { App } from 'obsidian';
import { rewriteReferences } from '@/references/rewrite-references';
import type { Affected } from '@/queries/find-profile-references';

export interface Updated {
	references: number;
	notes: number;
	failed: number;
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
