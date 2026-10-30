import type { App, TFile } from 'obsidian';
import type { Depot } from '@/depot';
import type { ReferenceUse } from '@/library/library-item';
import { findReferencesIn } from '@/references/find-references';

export async function collectReferenceUses(app: App, depot: Depot): Promise<ReferenceUse[]> {
	const files = app.vault.getFiles().filter((file: TFile) => file.extension === 'md' || file.extension === 'canvas');
	const uses: ReferenceUse[] = [];

	for (const file of files) {
		let text: string;

		try {
			text = await app.vault.cachedRead(file);
		} catch (error) {
			console.warn(`[Depot] Could not read ${file.path} for the library.`, error);
			continue;
		}

		for (const candidate of findReferencesIn(text)) {
			const reference = depot.attachments.from(candidate)?.reference;
			const profile = reference && depot.settings.profileFor(reference.profile.value)?.id;

			if (reference && profile) uses.push({ profile, key: reference.key, note: file.path });
		}
	}

	return uses;
}
