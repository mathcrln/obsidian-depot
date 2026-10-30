import type { App } from 'obsidian';
import { updateReferences } from '@/actions/update-references';
import type { Updated } from '@/actions/update-references';
import type { Affected } from '@/queries/find-profile-references';
import type { Settings } from '@/models/plugin-settings';

export type RenameOptions =
	| { references: 'keep' }
	| { references: 'update'; affected: Affected[]; onProgress?: (done: number, total: number) => void };

export type RenameProfileOptions = RenameOptions & {
	app: App;
	settings: Settings;
	save: () => Promise<void>;
	from: string;
	to: string;
};

export async function renameProfile(options: RenameProfileOptions): Promise<Updated> {
	const { app, settings, save, from, to } = options;

	settings.renameProfile(from, to);
	await save();

	if (options.references === 'keep' || options.affected.length === 0) {
		return { references: 0, notes: 0, failed: 0 };
	}

	const result = await updateReferences(app, options.affected, from, to, options.onProgress);

	if (result.failed === 0) {
		settings.forgetAlias(to, from);
		await save();
	}

	return result;
}
