import type { App } from 'obsidian';
import { updateReferences } from '@/actions/update-references';
import type { Updated } from '@/actions/update-references';
import { findProfileReferences } from '@/queries/find-profile-references';
import type { Settings } from '@/models/plugin-settings';

export interface UpdatePreviousReferencesOptions {
	app: App;
	settings: Settings;
	profileId: string;
	aliases: string[];
	save: () => Promise<void>;
}

export interface PreviousAliasesUpdate extends Updated {
	removedAliases: string[];
}

export async function updatePreviousReferences({
	app,
	settings,
	profileId,
	aliases,
	save,
}: UpdatePreviousReferencesOptions): Promise<PreviousAliasesUpdate> {
	let references = 0;
	let notes = 0;
	let failed = 0;
	const removedAliases: string[] = [];

	for (const alias of aliases) {
		const { affected } = await findProfileReferences(app, alias);
		const result = await updateReferences(app, affected, alias, profileId);

		references += result.references;
		notes += result.notes;
		failed += result.failed;

		if (result.failed === 0) {
			settings.forgetAlias(profileId, alias);
			if (affected.length === 0) removedAliases.push(alias);
		}
	}

	await save();

	return { references, notes, failed, removedAliases };
}
