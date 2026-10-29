import type { AttachmentReference } from '@/references/attachment-reference';
import { ProfileId } from '@/references/profile-id';
import type { ProfileSettings, Settings } from '@/settings/settings';
import type { ObjectStore } from '@/storages/object-store';
import { Profile } from '@/storages/profile';
import { NoDefaultProfile, ProfileDeleted, UnknownProfile } from '@/storages/profile-errors';

export interface StoragesOptions<A> {
	settings: Settings;
	storeFor: (profile: ProfileSettings) => ObjectStore;
	attach: (reference: AttachmentReference, name: string) => A;
}

export class Storages<A> {
	private readonly settings: Settings;
	private readonly createStore: (profile: ProfileSettings) => ObjectStore;
	private readonly attach: (reference: AttachmentReference, name: string) => A;

	constructor({ settings, storeFor, attach }: StoragesOptions<A>) {
		this.settings = settings;
		this.createStore = storeFor;
		this.attach = attach;
	}

	default(): Profile<A> {
		const settings = this.settings.defaultProfile;

		if (settings === undefined) {
			throw new NoDefaultProfile();
		}

		return this.build(settings);
	}

	profile(id: string): Profile<A> {
		return this.build(this.settingsFor(id));
	}

	storeFor(id: ProfileId | string): ObjectStore {
		return this.createStore(this.settingsFor(id.toString()));
	}

	recognizes(id: string): boolean {
		return this.settings.profile(id) !== undefined || this.settings.isRetired(id);
	}

	all(): Profile<A>[] {
		return this.settings.profiles.map((settings) => this.build(settings));
	}

	private settingsFor(id: string): ProfileSettings {
		const settings = this.settings.profile(id);

		if (settings !== undefined) {
			return settings;
		}

		throw this.settings.isRetired(id) ? new ProfileDeleted(id) : new UnknownProfile(id);
	}

	private build(settings: ProfileSettings): Profile<A> {
		return new Profile({ id: ProfileId.parse(settings.id), store: this.createStore(settings), attach: this.attach });
	}
}
