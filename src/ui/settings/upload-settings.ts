import type { Setting, SettingDefinition, SettingDefinitionItem } from 'obsidian';
import type { Profiles } from '@/actions/profiles';
import { ObjectId } from '@/uploads/object-ids';
import type { IdStyle } from '@/uploads/object-ids';
import { PathPattern } from '@/uploads/path-pattern';
import type { Settings } from '@/models/plugin-settings';

const PATTERN_HELP =
	'Placeholders: {yyyy} {mm} {dd} {name} {ext} {id} {type} {note}. {id} is required. Changing it does not affect existing references.';
const SAMPLE_HASH = '53670a34e119ae832528b72f8bd8750e'.repeat(2);
const ID_STYLE_OPTIONS: Record<IdStyle, string> = {
	'content-hash': 'Content hash',
	'uuid-v7': 'UUID v7',
	'uuid-v4': 'UUID v4',
	short: 'Short random',
	ulid: 'ULID',
};

interface UploadSettingsHost {
	settings: () => Settings;
	profiles: Profiles;
}

export function uploadSettings(id: string, host: UploadSettingsHost): SettingDefinitionItem {
	return {
		type: 'group',
		heading: 'Uploads',
		items: [
			pathPattern(id, host),
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
	};
}

function pathPattern(id: string, host: UploadSettingsHost): SettingDefinition {
	return {
		name: 'Path pattern',
		desc: PATTERN_HELP,
		render: (setting: Setting) => {
			const preview = createFragment();
			const line = preview.createDiv();
			preview.prepend(PATTERN_HELP);
			setting.setName('Path pattern').setDesc(preview);

			const show = (pattern: string): void => {
				try {
					line.setText(`Next upload: ${example(id, PathPattern.parse(pattern), host)}`);
					line.removeClass('mod-warning');
				} catch (error) {
					line.setText(error instanceof Error ? error.message : String(error));
					line.addClass('mod-warning');
				}
			};

			setting.addText((text) => {
				const current = host.settings().profile(id)?.pathPattern ?? PathPattern.DEFAULT.toString();
				text.setPlaceholder(PathPattern.DEFAULT.toString())
					.setValue(current)
					.onChange((value) => {
						const pattern = value.trim();
						show(pattern);

						if (host.settings().profile(id) === undefined || !PathPattern.isValid(pattern)) return;

						void host.profiles.update(id, { pathPattern: pattern });
					});
				show(current);
			});
		},
	};
}

function example(id: string, pattern: PathPattern, host: UploadSettingsHost): string {
	const profile = host.settings().profile(id);

	return pattern.keyFor(
		{
			fileName: 'photo.jpg',
			note: 'My note',
			id: ObjectId.generate(profile?.idStyle ?? 'content-hash', { hash: SAMPLE_HASH }),
		},
		{ lowercaseNames: profile?.lowercaseNames ?? true }
	);
}
