import { ProfileId } from '@/references/profile-id';
import { UnknownProfile } from '@/storages/profile-errors';
import { DEFAULT_ID_STYLE, ObjectId } from '@/uploads/object-ids';
import type { IdStyle } from '@/uploads/object-ids';
import { PathPattern } from '@/uploads/path-pattern';

export interface ProfileSettings {
	id: string;
	endpoint: string;
	bucket: string;
	region: string;
	forcePathStyle: boolean;
	accessKeySecret: string;
	secretKeySecret: string;
	pathPattern: string;
	lowercaseNames: boolean;
	idStyle: IdStyle;
	detectDuplicates: boolean;
	aliases: string[];
}

export interface DepotSettings {
	profiles: ProfileSettings[];
	defaultProfile: string | null;
	retiredProfiles: string[];
}

export type ProfileConnection = Partial<Omit<ProfileSettings, 'id'>>;

export class DuplicateProfile extends Error {
	constructor(id: string) {
		super(`A storage profile named "${id}" already exists`);
		this.name = 'DuplicateProfile';
	}
}

export class Settings {
	private constructor(
		private readonly entries: ProfileSettings[],
		private defaultId: string | null,
		private readonly retired: string[]
	) {}

	static empty(): Settings {
		return new Settings([], null, []);
	}

	static from(data: unknown): Settings {
		const record = isRecord(data) ? data : {};
		const entries: ProfileSettings[] = [];

		for (const raw of Array.isArray(record['profiles']) ? (record['profiles'] as unknown[]) : []) {
			const entry = normalise(raw);

			if (entry !== undefined && !entries.some((existing) => existing.id === entry.id)) {
				entries.push(entry);
			}
		}

		claimAliases(entries);

		const retired: string[] = [];

		for (const raw of Array.isArray(record['retiredProfiles']) ? (record['retiredProfiles'] as unknown[]) : []) {
			if (typeof raw === 'string' && ProfileId.isValid(raw) && !retired.includes(raw)) {
				retired.push(raw);
			}
		}

		const defaultId = record['defaultProfile'];

		return new Settings(
			entries,
			typeof defaultId === 'string' && entries.some((entry) => entry.id === defaultId) ? defaultId : null,
			retired.filter((id) => !entries.some((entry) => entry.id === id || entry.aliases.includes(id)))
		);
	}

	get profiles(): readonly ProfileSettings[] {
		return this.entries;
	}

	get defaultProfile(): ProfileSettings | undefined {
		if (this.defaultId !== null) {
			return this.profile(this.defaultId);
		}

		return this.entries.length === 1 ? this.entries[0] : undefined;
	}

	profile(id: string): ProfileSettings | undefined {
		return this.entries.find((entry) => entry.id === id);
	}

	profileFor(idOrAlias: string): ProfileSettings | undefined {
		return this.entries.find((entry) => entry.id === idOrAlias || entry.aliases.includes(idOrAlias));
	}

	isRetired(id: string): boolean {
		return this.retired.includes(id);
	}

	addProfile(id: string, connection: ProfileConnection = {}): ProfileSettings {
		const parsed = ProfileId.parse(id);

		if (this.profileFor(parsed.value) !== undefined) {
			throw new DuplicateProfile(parsed.value);
		}

		const profile: ProfileSettings = { ...blankProfile(parsed.value), ...definedOnly(connection) };

		this.entries.push(profile);
		this.retired.splice(0, this.retired.length, ...this.retired.filter((retiredId) => retiredId !== parsed.value));

		return profile;
	}

	updateProfile(id: string, changes: ProfileConnection): void {
		Object.assign(this.existing(id), definedOnly(changes));
	}

	renameProfile(from: string, to: string): void {
		const profile = this.existing(from);
		const target = ProfileId.parse(to).value;
		const owner = this.profileFor(target);

		if (owner !== undefined && owner !== profile) {
			throw new DuplicateProfile(target);
		}

		if (target === profile.id) {
			return;
		}

		if (this.defaultId === profile.id) {
			this.defaultId = target;
		}

		profile.aliases = [...profile.aliases.filter((alias) => alias !== target), profile.id];
		profile.id = target;
		this.retired.splice(0, this.retired.length, ...this.retired.filter((retiredId) => retiredId !== target));
	}

	forgetAlias(profileId: string, alias: string): void {
		const profile = this.existing(profileId);

		profile.aliases = profile.aliases.filter((existing) => existing !== alias);
	}

	removeProfile(id: string): void {
		const profile = this.existing(id);

		this.entries.splice(this.entries.indexOf(profile), 1);
		this.retired.push(profile.id, ...profile.aliases);

		if (this.defaultId === profile.id) {
			this.defaultId = null;
		}
	}

	makeDefault(id: string): void {
		this.defaultId = this.existing(id).id;
	}

	toJSON(): DepotSettings {
		return {
			profiles: this.entries.map((entry) => ({ ...entry })),
			defaultProfile: this.defaultId,
			retiredProfiles: [...this.retired],
		};
	}

	private existing(id: string): ProfileSettings {
		const profile = this.profileFor(id);

		if (profile === undefined) {
			throw new UnknownProfile(id);
		}

		return profile;
	}
}

function blankProfile(id: string): ProfileSettings {
	return {
		id,
		endpoint: '',
		bucket: '',
		region: 'auto',
		forcePathStyle: false,
		accessKeySecret: '',
		secretKeySecret: '',
		pathPattern: PathPattern.DEFAULT.toString(),
		lowercaseNames: true,
		idStyle: DEFAULT_ID_STYLE,
		detectDuplicates: false,
		aliases: [],
	};
}

function definedOnly(connection: ProfileConnection): ProfileConnection {
	return Object.fromEntries(Object.entries(connection).filter(([, value]) => value !== undefined));
}

function normalise(raw: unknown): ProfileSettings | undefined {
	if (!isRecord(raw) || typeof raw['id'] !== 'string' || !ProfileId.isValid(raw['id'])) {
		return undefined;
	}

	const blank = blankProfile(raw['id']);

	return {
		id: blank.id,
		endpoint: text(raw['endpoint'], blank.endpoint),
		bucket: text(raw['bucket'], blank.bucket),
		region: text(raw['region'], blank.region),
		forcePathStyle: typeof raw['forcePathStyle'] === 'boolean' ? raw['forcePathStyle'] : blank.forcePathStyle,
		accessKeySecret: text(raw['accessKeySecret'], blank.accessKeySecret),
		secretKeySecret: text(raw['secretKeySecret'], blank.secretKeySecret),
		pathPattern: validPattern(raw['pathPattern'], blank.pathPattern),
		lowercaseNames: typeof raw['lowercaseNames'] === 'boolean' ? raw['lowercaseNames'] : blank.lowercaseNames,
		idStyle: ObjectId.isStyle(raw['idStyle']) ? raw['idStyle'] : blank.idStyle,
		detectDuplicates: typeof raw['detectDuplicates'] === 'boolean' ? raw['detectDuplicates'] : blank.detectDuplicates,
		aliases: validIds(raw['aliases']),
	};
}

function validIds(value: unknown): string[] {
	const ids = Array.isArray(value) ? (value as unknown[]) : [];

	return ids.filter((id, index): id is string => typeof id === 'string' && ProfileId.isValid(id) && ids.indexOf(id) === index);
}

function claimAliases(entries: ProfileSettings[]): void {
	const taken = new Set(entries.map((entry) => entry.id));

	for (const entry of entries) {
		entry.aliases = entry.aliases.filter((alias) => !taken.has(alias) && taken.add(alias));
	}
}

function text(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function validPattern(value: unknown, fallback: string): string {
	return typeof value === 'string' && PathPattern.isValid(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
