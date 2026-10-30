import type { App } from 'obsidian';
import { renameProfile } from '@/actions/rename-profile';
import type { RenameOptions } from '@/actions/rename-profile';
import { updatePreviousReferences } from '@/actions/update-profile-references';
import type { PreviousAliasesUpdate } from '@/actions/update-profile-references';
import { findProfileReferences } from '@/queries/find-profile-references';
import type { Found } from '@/queries/find-profile-references';
import { Settings } from '@/models/plugin-settings';
import type { ProfileConnection, ProfileSettings } from '@/models/plugin-settings';
import { UnknownProfile } from '@/storages/profile-errors';
import type { Updated } from '@/actions/update-references';

export interface ProfilesOptions {
	app: App;
	settings: Settings;
	save: () => Promise<void>;
}

export class Profiles {
	constructor(private readonly options: ProfilesOptions) {}

	async add(id: string, connection: ProfileConnection = {}): Promise<ProfileSettings> {
		const profile = this.options.settings.addProfile(id, connection);
		await this.options.save();

		return profile;
	}

	update(id: string, changes: ProfileConnection): Promise<void> {
		this.options.settings.updateProfile(id, changes);

		return this.options.save();
	}

	makeDefault(id: string): Promise<void> {
		this.options.settings.makeDefault(id);

		return this.options.save();
	}

	remove(id: string): Promise<void> {
		this.options.settings.removeProfile(id);

		return this.options.save();
	}

	rename(from: string, to: string, options: RenameOptions = { references: 'keep' }): Promise<Updated> {
		return renameProfile({
			app: this.options.app,
			settings: this.options.settings,
			save: this.options.save,
			from,
			to,
			...options,
		});
	}

	previewRename(profileId: string): Promise<Found> {
		return findProfileReferences(this.options.app, profileId);
	}

	updatePreviousReferences(profileId: string): Promise<PreviousAliasesUpdate> {
		const profile = this.options.settings.profile(profileId);

		if (profile === undefined) throw new UnknownProfile(profileId);

		return updatePreviousReferences({
			app: this.options.app,
			settings: this.options.settings,
			profileId,
			aliases: [...profile.aliases],
			save: this.options.save,
		});
	}
}
