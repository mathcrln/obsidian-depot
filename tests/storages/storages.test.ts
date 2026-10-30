import { describe, expect, it } from 'vitest';
import { Settings } from '@/settings/settings';
import type { ProfileSettings } from '@/settings/settings';
import { NoDefaultProfile, ProfileDeleted, UnknownProfile } from '@/storages/profile-errors';
import type { ObjectStore } from '@/storages/object-store';
import { Storages } from '@/storages/storages';
import { MemoryUploadRegistry } from '@/uploads/memory-upload-registry';
import { FakeObjectStore } from '../support/fake-object-store';

describe('default', () => {
	it('is the configured default profile', () => {
		const { storages, settings } = GivenStorages('one', 'two');
		settings.makeDefault('two');

		expect(storages.default().id.value).toBe('two');
	});

	it('is the only profile', () => {
		expect(GivenStorages('one').storages.default().id.value).toBe('one');
	});

	it('throws when there is none', () => {
		expect(() => GivenStorages('one', 'two').storages.default()).toThrow(NoDefaultProfile);
	});

	it('follows settings edits immediately', () => {
		const { storages, settings } = GivenStorages('one', 'two');
		settings.makeDefault('one');
		expect(storages.default().id.value).toBe('one');

		settings.makeDefault('two');

		expect(storages.default().id.value).toBe('two');
	});
});

describe('profile', () => {
	it('returns a profile that uploads to the store for its settings', async () => {
		const { storages, stores } = GivenStorages('one', 'two');

		await storages.profile('two').upload({ name: 'a.png', arrayBuffer: async () => new ArrayBuffer(1) });

		expect(stores.get('two')?.puts).toHaveLength(1);
		expect(stores.get('one')?.puts).toHaveLength(0);
	});

	it('uploads with the path settings of its profile', async () => {
		const { storages, settings, stores } = GivenStorages('one', 'two');
		settings.updateProfile('two', { pathPattern: 'two/{id}' });

		await storages.profile('two').upload({ name: 'a.png', arrayBuffer: async () => new ArrayBuffer(1) });
		await storages.profile('one').upload({ name: 'a.png', arrayBuffer: async () => new ArrayBuffer(1) });

		expect(stores.get('two')?.puts[0]?.key).toMatch(/^two\/[0-9a-f]{32}$/);
		expect(stores.get('one')?.puts[0]?.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]{32}\.png$/);
	});

	it('throws UnknownProfile for an unknown id', () => {
		expect(() => GivenStorages('one').storages.profile('nope')).toThrow(UnknownProfile);
	});

	it('throws ProfileDeleted for a retired id', () => {
		const { storages, settings } = GivenStorages('one', 'two');
		settings.removeProfile('one');

		expect(() => storages.profile('one')).toThrow(ProfileDeleted);
	});

	it('resolves again once the id is re-created', () => {
		const { storages, settings } = GivenStorages('one', 'two');
		settings.removeProfile('one');
		settings.addProfile('one');

		expect(storages.profile('one').id.value).toBe('one');
	});
});

describe('storeFor', () => {
	it('returns the store for a string id', () => {
		const { storages, stores } = GivenStorages('one');

		expect(storages.storeFor('one')).toBe(stores.get('one'));
	});

	it('throws like profile for unknown and retired ids', () => {
		const { storages, settings } = GivenStorages('one');
		settings.removeProfile('one');

		expect(() => storages.storeFor('one')).toThrow(ProfileDeleted);
		expect(() => storages.storeFor('nope')).toThrow(UnknownProfile);
	});
});

describe('recognizes', () => {
	it('knows current and retired ids only', () => {
		const { storages, settings } = GivenStorages('one', 'two');
		settings.removeProfile('two');

		expect(storages.recognizes('one')).toBe(true);
		expect(storages.recognizes('two')).toBe(true);
		expect(storages.recognizes('slack')).toBe(false);
	});
});

describe('all', () => {
	it('lists the current profiles', () => {
		const { storages, settings } = GivenStorages('one', 'two');
		settings.removeProfile('one');

		expect(storages.all().map((profile) => profile.id.value)).toEqual(['two']);
	});
});

describe('renamed profiles', () => {
	it('resolves the previous id to the renamed profile', async () => {
		const { storages, settings, stores } = GivenStorages('old', 'other');
		settings.renameProfile('old', 'fresh');
		stores.set('fresh', stores.get('old')!);

		expect(storages.profile('old').id.value).toBe('fresh');
		expect(storages.profile('fresh').id.value).toBe('fresh');
		expect(storages.storeFor('old')).toBe(stores.get('fresh'));
	});

	it('recognizes the previous id', () => {
		const { storages, settings } = GivenStorages('old');
		settings.renameProfile('old', 'fresh');

		expect(storages.recognizes('old')).toBe(true);
		expect(storages.recognizes('fresh')).toBe(true);
	});

	it('stops resolving a forgotten alias but not as deleted', () => {
		const { storages, settings } = GivenStorages('old');
		settings.renameProfile('old', 'fresh');
		settings.forgetAlias('fresh', 'old');

		expect(storages.recognizes('old')).toBe(false);
		expect(() => storages.profile('old')).toThrow(UnknownProfile);
	});

	it('reports aliases of a deleted profile as deleted', () => {
		const { storages, settings } = GivenStorages('old');
		settings.renameProfile('old', 'fresh');
		settings.removeProfile('fresh');

		expect(() => storages.profile('old')).toThrow(ProfileDeleted);
		expect(storages.recognizes('old')).toBe(true);
	});
});

function GivenStorages(...ids: string[]) {
	const settings = Settings.empty();
	const stores = new Map<string, FakeObjectStore>();

	for (const id of ids) {
		settings.addProfile(id);
		stores.set(id, new FakeObjectStore());
	}

	const storages = new Storages({
		settings,
		storeFor: (profile: ProfileSettings): ObjectStore => stores.get(profile.id) ?? new FakeObjectStore(),
		registry: new MemoryUploadRegistry(),
		attach: (reference, name) => ({ reference, name }),
	});

	return { storages, settings, stores };
}
