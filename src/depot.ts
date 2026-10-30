import type { Plugin } from 'obsidian';
import type { Attachment } from '@/attachments/attachment';
import { Attachments } from '@/attachments/attachments';
import { Library } from '@/queries/library';
import { Notes } from '@/ui/notes/notes';
import { Profiles } from '@/actions/profiles';
import { browserObjectUrls } from '@/attachments/object-urls';
import { Resolver } from '@/attachments/resolver';
import { IndexedDbObjectCache } from '@/cache/indexed-db-object-cache';
import { MemoryObjectCache } from '@/cache/memory-object-cache';
import type { ObjectCache } from '@/cache/object-cache';
import { obsidianHttp } from '@/platform/obsidian-http';
import { obsidianSecrets } from '@/platform/obsidian-secrets';
import { Settings } from '@/models/plugin-settings';
import { S3ObjectStore } from '@/storages/s3-object-store';
import { Storages } from '@/storages/storages';
import { IndexedDbUploadRegistry } from '@/uploads/indexed-db-upload-registry';
import { MemoryUploadRegistry } from '@/uploads/memory-upload-registry';
import type { UploadRegistry } from '@/uploads/upload-registry';

export class Depot {
	private constructor(
		readonly settings: Settings,
		readonly storages: Storages<Attachment>,
		readonly attachments: Attachments,
		readonly notes: Notes,
		readonly profiles: Profiles,
		readonly library: Library,
		private readonly resolver: Resolver,
		private readonly cache: ObjectCache & { close?(): void },
		private readonly registry: UploadRegistry & { close?(): void }
	) {}

	static async boot(plugin: Plugin): Promise<Depot> {
		const settings = Settings.from(await plugin.loadData());
		const cache = await openCache(`depot-cache-${plugin.app.vault.getName()}`);
		const registry = await openRegistry(`depot-registry-${plugin.app.vault.getName()}`);
		const secrets = obsidianSecrets(plugin.app);

		const storages: Storages<Attachment> = new Storages({
			settings,
			storeFor: (profile) => S3ObjectStore.for(profile, { http: obsidianHttp, secrets }),
			registry,
			attach: (reference, name) => attachments.of(reference, name),
		});
		const resolver = new Resolver({ storeFor: (id) => storages.storeFor(id), cache, objectUrls: browserObjectUrls });
		const attachments = new Attachments({ resolver, recognizes: (id) => storages.recognizes(id) });
		const persist = (current: Settings) => plugin.saveData(current.toJSON());
		const notes = new Notes((file, context) => storages.default().upload(file, context));
		const profiles = new Profiles({ app: plugin.app, settings, save: () => persist(settings) });
		const library = new Library({ app: plugin.app, settings, storages, attachments });

		return new Depot(settings, storages, attachments, notes, profiles, library, resolver, cache, registry);
	}

	async clearCache(): Promise<void> {
		await this.cache.clear();
		await this.registry.clear();
	}

	release(): void {
		this.resolver.release();
		this.cache.close?.();
		this.registry.close?.();
	}
}

async function openCache(name: string): Promise<ObjectCache & { close?(): void }> {
	try {
		return await IndexedDbObjectCache.open(name);
	} catch (error) {
		console.warn('[Depot] Persistent cache unavailable, using memory instead.', error);
		return new MemoryObjectCache();
	}
}

async function openRegistry(name: string): Promise<UploadRegistry & { close?(): void }> {
	try {
		return await IndexedDbUploadRegistry.open(name);
	} catch (error) {
		console.warn('[Depot] Persistent upload registry unavailable, using memory instead.', error);
		return new MemoryUploadRegistry();
	}
}
