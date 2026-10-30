import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';

vi.mock('obsidian', () => ({
	Notice: class Notice {},
}));
import { ProfilePages } from '@/ui/settings/profile-page';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';

describe('ProfilePages', () => {
	it('composes a declarative profile page from connection, credential, and upload settings', () => {
		const settings = Settings.empty();
		const profile = settings.addProfile('personal');
		const secrets = new Set<string>();
		const app = { secretStorage: { getSecret: (id: string) => (secrets.has(id) ? 'stored' : null) } } as unknown as App;
		const page = new ProfilePages({
			app,
			settings: () => settings,
			profiles: new Profiles({ app, settings, save: async () => {} }),
			rename: () => {},
			refresh: () => {},
		}).of(profile);

		expect(page.type).toBe('page');
		expect(page.name).toBe('personal');
		expect(typeof page.status === 'function' ? page.status() : page.status).toBe('warning');
		const items = page.items ?? [];
		expect(items.flatMap((item) => ('type' in item && item.type === 'group' ? [item.heading] : []))).toEqual([
			'Connection',
			'Credentials',
			'Uploads',
		]);
		expect(
			items.flatMap((item) => ('type' in item && item.type === 'group' ? (item.items ?? []) : [])).map((item) => item.name)
		).toEqual([
			'Endpoint',
			'Bucket',
			'Region',
			'Path-style addressing',
			'Access key ID',
			'Secret access key',
			'Path pattern',
			'ID style',
			'Lowercase names',
			'Detect duplicates',
		]);
		expect(
			items
				.flatMap((item) => ('type' in item && item.type === 'group' ? (item.items ?? []) : []))
				.flatMap((item) => ('control' in item && item.control !== undefined ? [item.control.key] : []))
		).toEqual([
			'profile.personal.endpoint',
			'profile.personal.bucket',
			'profile.personal.region',
			'profile.personal.forcePathStyle',
			'profile.personal.idStyle',
			'profile.personal.lowercaseNames',
			'profile.personal.detectDuplicates',
		]);

		settings.updateProfile('personal', {
			bucket: 'media',
			accessKeySecret: 'key-id',
			secretKeySecret: 'secret-id',
		});
		secrets.add('key-id');
		secrets.add('secret-id');
		expect(typeof page.status === 'function' ? page.status() : page.status).toBe(null);
	});
});
