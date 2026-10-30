import { Notice, PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type DepotPlugin from '@/main';
import { AddProfileModal } from '@/settings/add-profile-modal';
import { RenameProfileModal } from '@/settings/rename-profile';
import { ProfilePages } from '@/settings/profile-page';
import { ObjectId } from '@/uploads/object-ids';

type TextField = 'endpoint' | 'bucket' | 'region' | 'idStyle';
type ToggleField = 'forcePathStyle' | 'lowercaseNames' | 'detectDuplicates';

export class DepotSettingTab extends PluginSettingTab {
	private readonly profilePages: ProfilePages;

	constructor(private readonly plugin: DepotPlugin) {
		super(plugin.app, plugin);
		this.profilePages = new ProfilePages({
			app: plugin.app,
			settings: () => this.settings,
			save: () => plugin.depot.save(),
			rename: (id) => this.renameProfile(id),
			refresh: () => this.update(),
		});
	}

	private get settings() {
		return this.plugin.depot.settings;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Default profile',
				desc: 'Where pasted, dropped, and uploaded attachments go.',
				visible: () => this.settings.profiles.length > 0,
				control: { type: 'dropdown', key: 'defaultProfile', options: this.defaultProfileOptions() },
			},
			{
				type: 'list',
				heading: 'Profiles',
				items: this.settings.profiles.map((profile) => this.profilePages.of(profile)),
				emptyState: 'No profiles yet.',
				addItem: { name: 'Add profile', action: () => this.askForProfile() },
				onDelete: (index) => void this.deleteProfile(index),
			},
			{
				type: 'group',
				heading: 'Cache',
				items: [
					{
						name: 'Clear cache',
						desc: 'Forget cached uploads and previews. Files in your storage are not touched.',
						action: () => void this.clearCache(),
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'defaultProfile') {
			return this.settings.defaultProfile?.id ?? '';
		}

		const field = parseKey(key);
		const profile = field && this.settings.profile(field.id);

		return field && profile ? profile[field.name] : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'defaultProfile') {
			if (typeof value === 'string' && value !== '') {
				this.settings.makeDefault(value);
				await this.commit(true);
			}

			return;
		}

		const field = parseKey(key);

		if (field === undefined || this.settings.profile(field.id) === undefined) return;

		if (field.name === 'forcePathStyle' || field.name === 'lowercaseNames' || field.name === 'detectDuplicates') {
			this.settings.updateProfile(field.id, { [field.name]: value === true });
		} else if (field.name === 'idStyle') {
			if (ObjectId.isStyle(value)) {
				this.settings.updateProfile(field.id, { idStyle: value });
				await this.commit(true);
			}

			return;
		} else if (typeof value === 'string') {
			this.settings.updateProfile(field.id, { [field.name]: value.trim() });
		}

		await this.commit(false);
	}

	private defaultProfileOptions(): Record<string, string> {
		const options: Record<string, string> = this.settings.defaultProfile === undefined ? { '': 'Choose a profile' } : {};

		for (const profile of this.settings.profiles) {
			options[profile.id] = profile.id;
		}

		return options;
	}

	private askForProfile(): void {
		new AddProfileModal(this.app, this.settings, async (id) => {
			this.settings.addProfile(id);
			await this.commit(true);
		}).open();
	}

	private renameProfile(id: string): void {
		new RenameProfileModal(
			{
				app: this.app,
				settings: this.settings,
				save: () => this.plugin.depot.save(),
				onChange: () => {
					this.update();
					this.showHome();
				},
			},
			id
		).open();
	}

	// The settings API has no public way to leave a sub-page, so reopen the tab through the internal one when it exists.
	private showHome(): void {
		const setting = (this.app as unknown as { setting?: { openTabById?: (id: string) => unknown } }).setting;

		setting?.openTabById?.(this.plugin.manifest.id);
	}

	private async deleteProfile(index: number): Promise<void> {
		const profile = this.settings.profiles[index];

		if (profile === undefined) return;

		this.settings.removeProfile(profile.id);
		await this.commit(true);
		new Notice('Profile deleted. References to it now show as unavailable.');
	}

	private async clearCache(): Promise<void> {
		await this.plugin.depot.clearCache();
		new Notice('Cache cleared.');
	}

	private async commit(structural: boolean): Promise<void> {
		await this.plugin.depot.save();

		if (structural) {
			this.update();
		}
	}
}

function parseKey(key: string): { id: string; name: TextField | ToggleField } | undefined {
	const match = /^profile\.([^.]+)\.(endpoint|bucket|region|forcePathStyle|lowercaseNames|idStyle|detectDuplicates)$/.exec(key);

	return match ? { id: match[1]!, name: match[2] as TextField | ToggleField } : undefined;
}
