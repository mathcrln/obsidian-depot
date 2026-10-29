import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type DepotPlugin from '@/main';
import type { ProfileConnection, ProfileSettings } from '@/settings/settings';

export class DepotSettingTab extends PluginSettingTab {
	private newProfileId = '';

	constructor(private readonly plugin: DepotPlugin) {
		super(plugin.app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.depot.settings;

		containerEl.empty();

		this.renderDefaultProfile(containerEl);
		this.renderAddProfile(containerEl);

		for (const profile of settings.profiles) {
			this.renderProfile(containerEl, profile);
		}

		new Setting(containerEl).setName('Cache').setHeading();
		new Setting(containerEl)
			.setName('Clear cache')
			.setDesc('Forget cached uploads and previews. Files in your storage are not touched.')
			.addButton((button) =>
				button.setButtonText('Clear cache').onClick(async () => {
					await this.plugin.depot.clearCache();
					new Notice('Cache cleared.');
				})
			);
	}

	private renderDefaultProfile(containerEl: HTMLElement): void {
		const settings = this.plugin.depot.settings;
		const setting = new Setting(containerEl).setName('Default profile');

		if (settings.profiles.length === 0) {
			setting.setDesc('Add a profile to choose a default.').addDropdown((dropdown) => dropdown.setDisabled(true));
			return;
		}

		setting.setDesc('Where pasted, dropped, and uploaded attachments go.').addDropdown((dropdown) => {
			const current = settings.defaultProfile?.id;

			if (current === undefined) {
				dropdown.addOption('', 'Choose a profile');
			}

			for (const profile of settings.profiles) {
				dropdown.addOption(profile.id, profile.id);
			}

			dropdown.setValue(current ?? '').onChange(async (id) => {
				if (!id) return;
				settings.makeDefault(id);
				await this.commit(true);
			});
		});
	}

	private renderAddProfile(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Add profile')
			.setDesc('Lowercase letters, digits, and hyphens, starting with a letter.')
			.addText((text) =>
				text
					.setPlaceholder('Identifier')
					.setValue(this.newProfileId)
					.onChange((value) => {
						this.newProfileId = value.trim();
					})
			)
			.addButton((button) =>
				button
					.setButtonText('Add')
					.setCta()
					.onClick(async () => {
						try {
							this.plugin.depot.settings.addProfile(this.newProfileId);
						} catch (error) {
							new Notice(error instanceof Error ? error.message : 'Could not add the profile.');
							return;
						}

						this.newProfileId = '';
						await this.commit(true);
					})
			);
	}

	private renderProfile(containerEl: HTMLElement, profile: ProfileSettings): void {
		const id = profile.id;

		new Setting(containerEl)
			.setName(id)
			.setDesc('Deleting a profile makes existing references to it show as unavailable.')
			.setHeading()
			.addButton((button) =>
				button
					.setButtonText('Delete')
					.setWarning()
					.onClick(async () => {
						this.plugin.depot.settings.removeProfile(id);
						await this.commit(true);
					})
			);

		new Setting(containerEl)
			.setName('Endpoint')
			.setDesc('Leave empty for AWS S3.')
			.addText((text) =>
				text
					.setPlaceholder('https://<account>.r2.cloudflarestorage.com')
					.setValue(profile.endpoint)
					.onChange((value) => this.change(id, { endpoint: value.trim() }))
			);

		new Setting(containerEl)
			.setName('Bucket')
			.addText((text) => text.setValue(profile.bucket).onChange((value) => this.change(id, { bucket: value.trim() })));

		new Setting(containerEl).setName('Region').addText((text) =>
			text
				.setPlaceholder('auto')
				.setValue(profile.region)
				.onChange((value) => this.change(id, { region: value.trim() }))
		);

		new Setting(containerEl)
			.setName('Path-style addressing')
			.setDesc('Needed for MinIO and some self-hosted services.')
			.addToggle((toggle) =>
				toggle.setValue(profile.forcePathStyle).onChange((value) => this.change(id, { forcePathStyle: value }))
			);

		this.addCredential(containerEl, 'Access key ID', profile.accessKeySecret || `depot-${id}-access-key-id`, (secretId) =>
			this.change(id, { accessKeySecret: secretId })
		);
		this.addCredential(
			containerEl,
			'Secret access key',
			profile.secretKeySecret || `depot-${id}-secret-access-key`,
			(secretId) => this.change(id, { secretKeySecret: secretId })
		);
	}

	private addCredential(containerEl: HTMLElement, name: string, secretId: string, onStored: (secretId: string) => void): void {
		const stored = Boolean(this.app.secretStorage.getSecret(secretId));

		new Setting(containerEl)
			.setName(name)
			.setDesc('Kept in Obsidian secret storage, never in plugin settings.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text.setPlaceholder(stored ? 'Stored — type to replace' : 'Not set').onChange((value) => {
					this.app.secretStorage.setSecret(secretId, value.trim());
					onStored(secretId);
				});
			});
	}

	private change(id: string, changes: ProfileConnection): void {
		this.plugin.depot.settings.updateProfile(id, changes);
		void this.commit(false);
	}

	private async commit(rerender: boolean): Promise<void> {
		await this.plugin.depot.save();

		if (rerender) {
			this.display();
		}
	}
}
