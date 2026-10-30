import { Notice, PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type DepotPlugin from '@/main';
import { AddProfileModal } from '@/ui/settings/add-profile-modal';
import { RenameProfileModal } from '@/ui/settings/rename-profile-modal';
import { ProfilePages } from '@/ui/settings/profile-page';
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
			profiles: plugin.depot.profiles,
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
				await this.plugin.depot.profiles.makeDefault(value);
				this.update();
			}

			return;
		}

		const field = parseKey(key);

		if (field === undefined || this.settings.profile(field.id) === undefined) return;

		if (field.name === 'forcePathStyle' || field.name === 'lowercaseNames' || field.name === 'detectDuplicates') {
			await this.plugin.depot.profiles.update(field.id, { [field.name]: value === true });
		} else if (field.name === 'idStyle') {
			if (ObjectId.isStyle(value)) {
				await this.plugin.depot.profiles.update(field.id, { idStyle: value });
				this.update();
			}

			return;
		} else if (typeof value === 'string') {
			await this.plugin.depot.profiles.update(field.id, { [field.name]: value.trim() });
		}
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
			await this.plugin.depot.profiles.add(id);
			this.update();
		}).open();
	}

	private renameProfile(id: string): void {
		new RenameProfileModal(
			{
				app: this.app,
				profiles: this.plugin.depot.profiles,
				settings: this.settings,
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

		await this.plugin.depot.profiles.remove(profile.id);
		this.update();
		new Notice('Profile deleted. References to it now show as unavailable.');
	}

	private async clearCache(): Promise<void> {
		await this.plugin.depot.clearCache();
		new Notice('Cache cleared.');
	}
}

function parseKey(key: string): { id: string; name: TextField | ToggleField } | undefined {
	const match = /^profile\.([^.]+)\.(endpoint|bucket|region|forcePathStyle|lowercaseNames|idStyle|detectDuplicates)$/.exec(key);

	const id = match?.[1];
	const name = match?.[2];

	return id !== undefined && name !== undefined ? { id, name: name as TextField | ToggleField } : undefined;
}
