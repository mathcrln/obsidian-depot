import { ProfileId } from '@/references/profile-id';
import { UnknownProfile } from '@/storages/profile-errors';

export interface ProfileSettings {
	id: string;
	endpoint: string;
	bucket: string;
	region: string;
	forcePathStyle: boolean;
	accessKeySecret: string;
	secretKeySecret: string;
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
			retired.filter((id) => !entries.some((entry) => entry.id === id))
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

	isRetired(id: string): boolean {
		return this.retired.includes(id);
	}

	addProfile(id: string, connection: ProfileConnection = {}): ProfileSettings {
		const parsed = ProfileId.parse(id);

		if (this.profile(parsed.value) !== undefined) {
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

	removeProfile(id: string): void {
		const profile = this.existing(id);

		this.entries.splice(this.entries.indexOf(profile), 1);
		this.retired.push(id);

		if (this.defaultId === id) {
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
		const profile = this.profile(id);

		if (profile === undefined) {
			throw new UnknownProfile(id);
		}

		return profile;
	}
}

function blankProfile(id: string): ProfileSettings {
	return { id, endpoint: '', bucket: '', region: 'auto', forcePathStyle: false, accessKeySecret: '', secretKeySecret: '' };
}

function definedOnly(connection: ProfileConnection): ProfileConnection {
	return Object.fromEntries(Object.entries(connection).filter(([, value]) => value !== undefined)) as ProfileConnection;
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
	};
}

function text(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
