import type { SettingDefinitionItem } from 'obsidian';

export function connectionSettings(id: string): SettingDefinitionItem {
	return {
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
	};
}
