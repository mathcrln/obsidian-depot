import { Str } from '@/utils/str';
import { Notice } from 'obsidian';
import type { App, Setting, SettingDefinition, SettingDefinitionPage } from 'obsidian';
import { findReferences, updateReferences } from '@/settings/reference-updates';
import type { ProfileSettings, Settings } from '@/settings/settings';
import { ObjectId } from '@/uploads/object-ids';
import type { IdStyle } from '@/uploads/object-ids';
import { PathPattern } from '@/uploads/path-pattern';

const PATTERN_HELP =
	'Placeholders: {yyyy} {mm} {dd} {name} {ext} {id} {type} {note}. {id} is required. Changing it does not affect existing references.';

const NOT_SET = 'Not set';

const SAMPLE_HASH = '53670a34e119ae832528b72f8bd8750e'.repeat(2);

const ID_STYLE_OPTIONS: Record<IdStyle, string> = {
	'content-hash': 'Content hash',
	'uuid-v7': 'UUID v7',
	'uuid-v4': 'UUID v4',
	short: 'Short random',
	ulid: 'ULID',
};

export interface ProfilePagesHost {
	app: App;
	settings: () => Settings;
	save: () => Promise<void>;
	rename: (id: string) => void;
	refresh: () => void;
}

export class ProfilePages {
	constructor(private readonly host: ProfilePagesHost) {}

	private get settings(): Settings {
		return this.host.settings();
	}

	of(profile: ProfileSettings): SettingDefinitionPage {
		const id = profile.id;

		return {
			type: 'page',
			name: id,
			displayValue: () => this.settings.profile(id)?.bucket || 'Not configured',
			status: () => (this.needsAttention(id) ? 'warning' : null),
			items: [
				this.renameRow(id),
				...this.previousNamesRow(id),
				{
					type: 'group',
					heading: 'Connection',
					items: [
						{
							name: 'Endpoint',
							desc: 'Leave empty for AWS S3.',
							control: {
								type: 'text',
								key: `profile.${id}.endpoint`,
								placeholder: 'https://<account>.r2.cloudflarestorage.com',
							},
						},
						{ name: 'Bucket', control: { type: 'text', key: `profile.${id}.bucket` } },
						{ name: 'Region', control: { type: 'text', key: `profile.${id}.region`, placeholder: 'auto' } },
						{
							name: 'Path-style addressing',
							desc: 'Needed for MinIO and some self-hosted services.',
							control: { type: 'toggle', key: `profile.${id}.forcePathStyle` },
						},
					],
				},
				{
					type: 'group',
					heading: 'Credentials',
					items: [
						this.credential(id, 'Access key ID', 'accessKeySecret', `depot-${id}-access-key-id`),
						this.credential(id, 'Secret access key', 'secretKeySecret', `depot-${id}-secret-access-key`),
					],
				},
				{
					type: 'group',
					heading: 'Uploads',
					items: [
						this.pathPattern(id),
						{
							name: 'ID style',
							desc: 'How {id} is generated. Content hash gives identical files the same ID.',
							control: { type: 'dropdown', key: `profile.${id}.idStyle`, options: ID_STYLE_OPTIONS },
						},
						{
							name: 'Lowercase names',
							desc: 'Lowercase file and note names in upload paths.',
							control: { type: 'toggle', key: `profile.${id}.lowercaseNames` },
						},
						{
							name: 'Detect duplicates',
							desc: 'Reuses files you already uploaded, across devices. Adds one request and a small record in the bucket (in .depot/) for each upload.',
							control: { type: 'toggle', key: `profile.${id}.detectDuplicates` },
						},
					],
				},
			],
		};
	}

	private renameRow(id: string): SettingDefinition {
		return {
			name: 'Rename profile',
			desc: 'References in your notes use this name.',
			render: (setting: Setting) => {
				const desc = createFragment();

				desc.appendText('References in your notes use this name, like ');
				desc.createEl('code', { text: `${id}://…` });
				desc.appendText('.');
				setting
					.setName('Rename profile')
					.setDesc(desc)
					.addButton((button) => button.setButtonText('Rename…').onClick(() => this.host.rename(id)));
			},
		};
	}

	private previousNamesRow(id: string): SettingDefinition[] {
		const aliases = this.settings.profile(id)?.aliases ?? [];

		if (aliases.length === 0) return [];

		return [
			{
				name: 'Previous names',
				desc: 'Old references still work.',
				render: (setting: Setting) => {
					const desc = createFragment();

					desc.appendText('Old references using ');
					aliases.forEach((alias, index) => {
						if (index > 0) desc.appendText(', ');
						desc.createEl('code', { text: alias });
					});
					desc.appendText(' still work.');
					setting
						.setName('Previous names')
						.setDesc(desc)
						.addButton((button) =>
							button.setButtonText('Update notes').onClick(async () => {
								button.setDisabled(true);
								await this.updateNotes(id, aliases);
								this.host.refresh();
							})
						);
				},
			},
		];
	}

	private async updateNotes(id: string, aliases: string[]): Promise<void> {
		let references = 0;
		let notes = 0;
		let failed = 0;
		const removed: string[] = [];

		for (const alias of aliases) {
			const { affected } = await findReferences(this.host.app, alias);
			const result = await updateReferences(this.host.app, affected, alias, id);

			references += result.references;
			notes += result.notes;
			failed += result.failed;

			if (result.failed === 0) {
				this.settings.forgetAlias(id, alias);
				if (affected.length === 0) removed.push(alias);
			}
		}

		await this.host.save();

		if (failed > 0) {
			new Notice(`Could not update ${Str.quantity(failed, 'note')}. Older references keep working.`);
		} else if (references === 0 && removed.length === aliases.length) {
			new Notice(`No notes used ${removed.join(', ')} — removed ${removed.length === 1 ? 'it' : 'them'}.`);
		} else {
			new Notice(`Updated ${Str.quantity(references, 'reference')} in ${Str.quantity(notes, 'note')}.`);
		}
	}

	private pathPattern(id: string): SettingDefinition {
		return {
			name: 'Path pattern',
			desc: PATTERN_HELP,
			render: (setting: Setting) => {
				const preview = createFragment();
				const line = preview.createDiv();

				preview.prepend(PATTERN_HELP);
				setting.setName('Path pattern').setDesc(preview);

				const show = (pattern: string) => {
					try {
						line.setText(`Next upload: ${this.example(id, PathPattern.parse(pattern))}`);
						line.removeClass('mod-warning');
					} catch (error) {
						line.setText(error instanceof Error ? error.message : String(error));
						line.addClass('mod-warning');
					}
				};

				setting.addText((text) => {
					const current = this.settings.profile(id)?.pathPattern ?? PathPattern.DEFAULT.toString();

					text.setPlaceholder(PathPattern.DEFAULT.toString())
						.setValue(current)
						.onChange((value) => {
							const pattern = value.trim();

							show(pattern);

							if (this.settings.profile(id) === undefined || !PathPattern.isValid(pattern)) return;

							this.settings.updateProfile(id, { pathPattern: pattern });
							void this.host.save();
						});
					show(current);
				});
			},
		};
	}

	private example(id: string, pattern: PathPattern): string {
		const profile = this.settings.profile(id);

		return pattern.keyFor(
			{
				fileName: 'photo.jpg',
				note: 'My note',
				id: ObjectId.generate(profile?.idStyle ?? 'content-hash', { hash: SAMPLE_HASH }),
			},
			{ lowercaseNames: profile?.lowercaseNames ?? true }
		);
	}

	private credential(
		id: string,
		name: string,
		field: 'accessKeySecret' | 'secretKeySecret',
		fallbackSecretId: string
	): SettingDefinition {
		return {
			name,
			desc: 'Kept in Obsidian secret storage, never in plugin settings.',
			render: (setting: Setting) => {
				const secretId = this.settings.profile(id)?.[field] || fallbackSecretId;
				const stored = this.hasSecret(secretId);

				setting.setName(name).setDesc('Kept in Obsidian secret storage, never in plugin settings.');
				setting.addText((text) => {
					text.inputEl.type = 'password';
					text.setPlaceholder(stored ? 'Stored — type to replace' : NOT_SET).onChange((value) => {
						this.host.app.secretStorage.setSecret(secretId, value.trim());

						if (this.settings.profile(id) === undefined) return;

						this.settings.updateProfile(id, { [field]: secretId });
						void this.host.save();
					});
					// Re-render only when leaving the field, so typing is never interrupted.
					text.inputEl.addEventListener('change', () => {
						if (this.hasSecret(secretId) !== stored) this.host.refresh();
					});
				});
			},
		};
	}

	private needsAttention(id: string): boolean {
		const profile = this.settings.profile(id);

		return (
			profile === undefined ||
			profile.bucket === '' ||
			!this.hasSecret(profile.accessKeySecret) ||
			!this.hasSecret(profile.secretKeySecret)
		);
	}

	private hasSecret(secretId: string): boolean {
		return secretId !== '' && Boolean(this.host.app.secretStorage.getSecret(secretId));
	}
}
