import type { App, TFile } from 'obsidian';
import type { Attachments } from '@/attachments/attachments';
import type { ReferenceUse } from '@/library/library-item';
import type { Settings } from '@/models/plugin-settings';
import { findReferencesIn } from '@/references/find-references';

export interface FindReferenceUsesOptions {
	app: App;
	attachments: Pick<Attachments, 'from'>;
	settings: Pick<Settings, 'profileFor'>;
	scans?: ReferenceScanCache;
}

interface Scan {
	mtime: number;
	size: number;
	candidates: string[];
}

export class ReferenceScanCache {
	private readonly scans = new Map<string, Scan>();

	async candidatesIn(app: App, file: TFile): Promise<string[] | undefined> {
		const cached = this.scans.get(file.path);

		if (cached && cached.mtime === file.stat.mtime && cached.size === file.stat.size) return cached.candidates;

		try {
			const candidates = findReferencesIn(await app.vault.cachedRead(file));
			this.scans.set(file.path, { mtime: file.stat.mtime, size: file.stat.size, candidates });

			return candidates;
		} catch (error) {
			console.warn(`[Depot] Could not read ${file.path} for the library.`, error);
			this.scans.delete(file.path);

			return undefined;
		}
	}

	retainOnly(files: TFile[]): void {
		const paths = new Set(files.map((file) => file.path));

		for (const path of this.scans.keys()) if (!paths.has(path)) this.scans.delete(path);
	}
}

export async function findReferenceUses({
	app,
	attachments,
	settings,
	scans = new ReferenceScanCache(),
}: FindReferenceUsesOptions): Promise<ReferenceUse[]> {
	const files = app.vault.getFiles().filter((file: TFile) => file.extension === 'md' || file.extension === 'canvas');
	const uses: ReferenceUse[] = [];

	scans.retainOnly(files);

	for (const file of files) {
		for (const candidate of (await scans.candidatesIn(app, file)) ?? []) {
			const reference = attachments.from(candidate)?.reference;
			const profile = reference && settings.profileFor(reference.profile.value)?.id;

			if (reference && profile) uses.push({ profile, key: reference.key, note: file.path });
		}
	}

	return uses;
}
