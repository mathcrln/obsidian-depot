import type { AttachmentReference } from '@/references/attachment-reference';
import { ProfileId } from '@/references/profile-id';
import type { ProfileSettings, Settings } from '@/models/plugin-settings';
import type { ObjectStore } from '@/storages/object-store';
import { Profile } from '@/storages/profile';
import type { UploadRegistry } from '@/uploads/upload-registry';
import { NoDefaultProfile, ProfileDeleted, UnknownProfile } from '@/storages/profile-errors';

export interface StoragesOptions<A> {
	settings: Settings;
	storeFor: (profile: ProfileSettings) => ObjectStore;
	registry: UploadRegistry;
	attach: (reference: AttachmentReference, name: string) => A;
}

export class Storages<A> {
	private readonly settings: Settings;
	private readonly createStore: (profile: ProfileSettings) => ObjectStore;
	private readonly registry: UploadRegistry;
	private readonly attach: (reference: AttachmentReference, name: string) => A;

	constructor({ settings, storeFor, registry, attach }: StoragesOptions<A>) {
		this.settings = settings;
		this.createStore = storeFor;
		this.registry = registry;
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
		return this.settings.profileFor(id) !== undefined || this.settings.isRetired(id);
	}

	all(): Profile<A>[] {
		return this.settings.profiles.map((settings) => this.build(settings));
	}

	private settingsFor(id: string): ProfileSettings {
		const settings = this.settings.profileFor(id);

		if (settings !== undefined) {
			return settings;
		}

		throw this.settings.isRetired(id) ? new ProfileDeleted(id) : new UnknownProfile(id);
	}

	private build(settings: ProfileSettings): Profile<A> {
		return new Profile({
			id: ProfileId.parse(settings.id),
			settings,
			store: this.createStore(settings),
			registry: this.registry,
			attach: this.attach,
		});
	}
}
