import { describe, expect, it } from 'vitest';
import { InvalidProfileId } from '@/references/profile-id';
import { DuplicateProfile, Settings } from '@/models/plugin-settings';
import { UnknownProfile } from '@/storages/profile-errors';

describe('loading', () => {
	it.each([null, undefined, 'junk', 42, [], {}])('starts empty from %j', (data) => {
		const settings = Settings.from(data);

		expect(settings.toJSON()).toEqual({ profiles: [], defaultProfile: null, retiredProfiles: [] });
	});

	it('fills connection defaults for partial profiles', () => {
		const settings = Settings.from({ profiles: [{ id: 'r2', bucket: 'vault' }] });

		expect(settings.profile('r2')).toEqual({
			id: 'r2',
			endpoint: '',
			region: 'auto',
			bucket: 'vault',
			forcePathStyle: false,
			accessKeySecret: '',
			secretKeySecret: '',
			pathPattern: '{yyyy}/{mm}/{id}.{ext}',
			lowercaseNames: true,
			idStyle: 'content-hash',
			detectDuplicates: false,
			aliases: [],
		});
	});

	it('keeps stored upload path settings', () => {
		const settings = Settings.from({
			profiles: [{ id: 'one', pathPattern: '{type}/{id}', lowercaseNames: false }],
		});

		expect(settings.profile('one')).toMatchObject({
			pathPattern: '{type}/{id}',
			lowercaseNames: false,
		});
	});

	it('ignores a legacy untitledNote setting', () => {
		const settings = Settings.from({ profiles: [{ id: 'one', untitledNote: 'loose' }] });

		expect(settings.profile('one')).not.toHaveProperty('untitledNote');
		expect(JSON.stringify(settings.toJSON())).not.toContain('untitledNote');
	});

	it.each(['{name}.{ext}', '/{id}', '{nope}-{id}', '', 7, null])(
		'falls back to the default pattern for stored %j',
		(pathPattern) => {
			const settings = Settings.from({ profiles: [{ id: 'one', pathPattern }] });

			expect(settings.profile('one')?.pathPattern).toBe('{yyyy}/{mm}/{id}.{ext}');
		}
	);

	it('keeps stored identifier and duplicate detection settings', () => {
		const settings = Settings.from({ profiles: [{ id: 'one', idStyle: 'uuid-v7', detectDuplicates: true }] });

		expect(settings.profile('one')).toMatchObject({ idStyle: 'uuid-v7', detectDuplicates: true });
	});

	it.each(['md5', 7, null, 'ULID'])('falls back to content-hash for stored id style %j', (idStyle) => {
		const settings = Settings.from({ profiles: [{ id: 'one', idStyle }] });

		expect(settings.profile('one')?.idStyle).toBe('content-hash');
	});

	it.each(['yes', 1, null])('keeps duplicate detection off for stored %j', (detectDuplicates) => {
		const settings = Settings.from({ profiles: [{ id: 'one', detectDuplicates }] });

		expect(settings.profile('one')?.detectDuplicates).toBe(false);
	});

	it('ignores wrongly typed upload options', () => {
		const settings = Settings.from({ profiles: [{ id: 'one', lowercaseNames: 'no' }] });

		expect(settings.profile('one')).toMatchObject({ lowercaseNames: true });
	});

	it('drops profiles with invalid or duplicate ids and junk entries', () => {
		const settings = Settings.from({
			profiles: [{ id: 'Bad' }, { id: 'http' }, 'x', null, { id: 'one', bucket: 'first' }, { id: 'one', bucket: 'second' }],
		});

		expect(settings.profiles.map((profile) => profile.id)).toEqual(['one']);
		expect(settings.profile('one')?.bucket).toBe('first');
	});

	it('ignores wrongly typed fields', () => {
		const settings = Settings.from({
			profiles: [{ id: 'one', bucket: 3, forcePathStyle: 'yes' }],
			defaultProfile: 7,
			retiredProfiles: 'x',
		});

		expect(settings.profile('one')?.bucket).toBe('');
		expect(settings.profile('one')?.forcePathStyle).toBe(false);
		expect(settings.toJSON().defaultProfile).toBeNull();
		expect(settings.toJSON().retiredProfiles).toEqual([]);
	});

	it('keeps only valid unique retired ids and drops a default that is not configured', () => {
		const settings = Settings.from({
			profiles: [{ id: 'one' }],
			defaultProfile: 'gone',
			retiredProfiles: ['old', 'old', 'Bad', 3],
		});

		expect(settings.toJSON().retiredProfiles).toEqual(['old']);
		expect(settings.toJSON().defaultProfile).toBeNull();
	});

	it('round-trips its own json', () => {
		const original = GivenSettings('one', 'two');
		original.makeDefault('two');
		original.removeProfile('one');

		expect(Settings.from(original.toJSON()).toJSON()).toEqual(original.toJSON());
	});
});

describe('adding profiles', () => {
	it('adds a profile with defaults', () => {
		const settings = Settings.empty();

		const profile = settings.addProfile('r2', { bucket: 'vault', endpoint: 'https://x.example' });

		expect(profile.bucket).toBe('vault');
		expect(profile.region).toBe('auto');
		expect(settings.profile('r2')).toBe(profile);
	});

	it('starts a new profile with the default upload path settings', () => {
		const profile = Settings.empty().addProfile('r2');

		expect(profile).toMatchObject({
			pathPattern: '{yyyy}/{mm}/{id}.{ext}',
			lowercaseNames: true,
		});
	});

	it('updates upload path settings per profile', () => {
		const settings = GivenSettings('one', 'two');

		settings.updateProfile('one', { pathPattern: '{id}', lowercaseNames: false });

		expect(settings.profile('one')).toMatchObject({ pathPattern: '{id}', lowercaseNames: false });
		expect(settings.profile('two')?.pathPattern).toBe('{yyyy}/{mm}/{id}.{ext}');
	});

	it('rejects an invalid id', () => {
		expect(() => Settings.empty().addProfile('Bad id')).toThrow(InvalidProfileId);
	});

	it('rejects a duplicate id', () => {
		const settings = GivenSettings('one');

		expect(() => settings.addProfile('one')).toThrow(DuplicateProfile);
	});

	it('un-retires a previously removed id', () => {
		const settings = GivenSettings('one');
		settings.removeProfile('one');

		settings.addProfile('one');

		expect(settings.isRetired('one')).toBe(false);
	});
});

describe('updating profiles', () => {
	it('changes connection fields but not the id', () => {
		const settings = GivenSettings('one');

		settings.updateProfile('one', { bucket: 'b', forcePathStyle: true });

		expect(settings.profile('one')).toMatchObject({ id: 'one', bucket: 'b', forcePathStyle: true });
	});

	it('throws for an unknown profile', () => {
		expect(() => Settings.empty().updateProfile('nope', { bucket: 'b' })).toThrow(UnknownProfile);
	});
});

describe('removing profiles', () => {
	it('removes the profile and retires its id', () => {
		const settings = GivenSettings('one', 'two');

		settings.removeProfile('one');

		expect(settings.profile('one')).toBeUndefined();
		expect(settings.isRetired('one')).toBe(true);
		expect(settings.isRetired('two')).toBe(false);
	});

	it('clears the default when removing it', () => {
		const settings = GivenSettings('one', 'two');
		settings.makeDefault('one');

		settings.removeProfile('one');

		expect(settings.toJSON().defaultProfile).toBeNull();
	});

	it('throws for an unknown profile', () => {
		expect(() => Settings.empty().removeProfile('nope')).toThrow(UnknownProfile);
	});
});

describe('default profile', () => {
	it('is the configured default', () => {
		const settings = GivenSettings('one', 'two');

		settings.makeDefault('two');

		expect(settings.defaultProfile?.id).toBe('two');
	});

	it('is the only profile when none is configured', () => {
		expect(GivenSettings('one').defaultProfile?.id).toBe('one');
	});

	it('is undefined when several exist and none is configured', () => {
		expect(GivenSettings('one', 'two').defaultProfile).toBeUndefined();
	});

	it('is undefined without profiles', () => {
		expect(Settings.empty().defaultProfile).toBeUndefined();
	});

	it('refuses an unknown profile', () => {
		expect(() => GivenSettings('one').makeDefault('nope')).toThrow(UnknownProfile);
	});
});

describe('credentials', () => {
	it('serialises secret ids only', () => {
		const settings = GivenSettings('one');
		settings.updateProfile('one', { accessKeySecret: 'depot-one-access', secretKeySecret: 'depot-one-secret' });

		const json = JSON.stringify(settings.toJSON());

		expect(json).toContain('depot-one-access');
		expect(Object.keys(settings.profile('one') ?? {}).sort()).toEqual([
			'accessKeySecret',
			'aliases',
			'bucket',
			'detectDuplicates',
			'endpoint',
			'forcePathStyle',
			'id',
			'idStyle',
			'lowercaseNames',
			'pathPattern',
			'region',
			'secretKeySecret',
		]);
	});
});

describe('renaming profiles', () => {
	it('gives the profile its new id and remembers the old one', () => {
		const settings = GivenSettings('old', 'other');

		settings.renameProfile('old', 'fresh');

		expect(settings.profiles.map((profile) => profile.id)).toEqual(['fresh', 'other']);
		expect(settings.profile('old')).toBeUndefined();
		expect(settings.profile('fresh')?.aliases).toEqual(['old']);
	});

	it('keeps the connection and credentials of the profile', () => {
		const settings = GivenSettings('old');
		settings.updateProfile('old', { bucket: 'vault', accessKeySecret: 'secret-a', secretKeySecret: 'secret-b' });

		settings.renameProfile('old', 'fresh');

		expect(settings.profile('fresh')).toMatchObject({
			bucket: 'vault',
			accessKeySecret: 'secret-a',
			secretKeySecret: 'secret-b',
		});
	});

	it('moves the default with the profile', () => {
		const settings = GivenSettings('old', 'other');
		settings.makeDefault('old');

		settings.renameProfile('old', 'fresh');

		expect(settings.defaultProfile?.id).toBe('fresh');
	});

	it('leaves another default alone', () => {
		const settings = GivenSettings('old', 'other');
		settings.makeDefault('other');

		settings.renameProfile('old', 'fresh');

		expect(settings.defaultProfile?.id).toBe('other');
	});

	it('rejects an invalid new id', () => {
		const settings = GivenSettings('old');

		expect(() => settings.renameProfile('old', 'Bad Id')).toThrow(InvalidProfileId);
		expect(settings.profile('old')).toBeDefined();
	});

	it('rejects the id of another profile', () => {
		const settings = GivenSettings('old', 'other');

		expect(() => settings.renameProfile('old', 'other')).toThrow(DuplicateProfile);
		expect(settings.profiles.map((profile) => profile.id)).toEqual(['old', 'other']);
	});

	it('rejects the alias of another profile', () => {
		const settings = GivenSettings('old', 'other');
		settings.renameProfile('other', 'newer');

		expect(() => settings.renameProfile('old', 'other')).toThrow(DuplicateProfile);
	});

	it('throws for an unknown profile', () => {
		expect(() => GivenSettings('one').renameProfile('nope', 'fresh')).toThrow(UnknownProfile);
	});

	it('accepts an alias of the same profile and drops that alias', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		settings.renameProfile('fresh', 'old');

		expect(settings.profile('old')?.aliases).toEqual(['fresh']);
	});

	it('keeps earlier aliases when renaming again', () => {
		const settings = GivenSettings('a');

		settings.renameProfile('a', 'b');
		settings.renameProfile('b', 'c');

		expect(settings.profile('c')?.aliases).toEqual(['a', 'b']);
	});

	it('un-retires the new id', () => {
		const settings = GivenSettings('old', 'gone');
		settings.removeProfile('gone');

		settings.renameProfile('old', 'gone');

		expect(settings.isRetired('gone')).toBe(false);
		expect(settings.profile('gone')).toBeDefined();
	});

	it('does nothing when renaming to the same id', () => {
		const settings = GivenSettings('one');

		settings.renameProfile('one', 'one');

		expect(settings.profile('one')?.aliases).toEqual([]);
	});

	it('persists aliases', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		expect(Settings.from(settings.toJSON()).profile('fresh')?.aliases).toEqual(['old']);
	});
});

describe('aliases', () => {
	it('resolve to the renamed profile', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		expect(settings.profileFor('old')?.id).toBe('fresh');
		expect(settings.profileFor('fresh')?.id).toBe('fresh');
		expect(settings.profileFor('nope')).toBeUndefined();
	});

	it('can be forgotten', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		settings.forgetAlias('fresh', 'old');

		expect(settings.profileFor('old')).toBeUndefined();
		expect(settings.profile('fresh')?.aliases).toEqual([]);
	});

	it('forgetting an alias works through any known name of the profile', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		settings.forgetAlias('old', 'old');

		expect(settings.profile('fresh')?.aliases).toEqual([]);
	});

	it('are retired with the profile', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		settings.removeProfile('fresh');

		expect(settings.isRetired('fresh')).toBe(true);
		expect(settings.isRetired('old')).toBe(true);
		expect(settings.profileFor('old')).toBeUndefined();
	});

	it('can be removed by removing the profile through an alias', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		settings.removeProfile('old');

		expect(settings.profiles).toHaveLength(0);
	});

	it('are not retired while the profile exists', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		expect(settings.isRetired('old')).toBe(false);
	});

	it('block adding a profile with the same id', () => {
		const settings = GivenSettings('old');
		settings.renameProfile('old', 'fresh');

		expect(() => settings.addProfile('old')).toThrow(DuplicateProfile);
	});

	it('are normalised on load', () => {
		const settings = Settings.from({
			profiles: [
				{ id: 'one', aliases: ['a', 'a', 'Bad', 3, 'one', 'two', 'b'] },
				{ id: 'two', aliases: ['b', 'c'] },
			],
			retiredProfiles: ['a', 'z'],
		});

		expect(settings.profile('one')?.aliases).toEqual(['a', 'b']);
		expect(settings.profile('two')?.aliases).toEqual(['c']);
		expect(settings.toJSON().retiredProfiles).toEqual(['z']);
	});

	it.each(['x', null, 5])('ignore a stored non-array %j', (aliases) => {
		expect(Settings.from({ profiles: [{ id: 'one', aliases }] }).profile('one')?.aliases).toEqual([]);
	});
});

function GivenSettings(...ids: string[]): Settings {
	const settings = Settings.empty();

	for (const id of ids) {
		settings.addProfile(id);
	}

	return settings;
}
