import { describe, expect, it } from 'vitest';
import { InvalidProfileId } from '@/references/profile-id';
import { DuplicateProfile, Settings } from '@/settings/settings';
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
		});
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
			'bucket',
			'endpoint',
			'forcePathStyle',
			'id',
			'region',
			'secretKeySecret',
		]);
	});
});

function GivenSettings(...ids: string[]): Settings {
	const settings = Settings.empty();

	for (const id of ids) {
		settings.addProfile(id);
	}

	return settings;
}
