import type { Plugin } from 'obsidian';
import type { Attachment } from '@/attachments/attachment';
import { Attachments } from '@/attachments/attachments';
import { browserObjectUrls } from '@/attachments/object-urls';
import { Resolver } from '@/attachments/resolver';
import { IndexedDbObjectCache } from '@/cache/indexed-db-object-cache';
import { MemoryObjectCache } from '@/cache/memory-object-cache';
import type { ObjectCache } from '@/cache/object-cache';
import { obsidianHttp } from '@/platform/obsidian-http';
import { obsidianSecrets } from '@/platform/obsidian-secrets';
import { Settings } from '@/settings/settings';
import { S3ObjectStore } from '@/storages/s3-object-store';
import { Storages } from '@/storages/storages';

export class Depot {
	private constructor(
		readonly settings: Settings,
		readonly storages: Storages<Attachment>,
		readonly attachments: Attachments,
		private readonly resolver: Resolver,
		private readonly cache: ObjectCache & { close?(): void },
		private readonly persist: (settings: Settings) => Promise<void>
	) {}

	static async boot(plugin: Plugin): Promise<Depot> {
		const settings = Settings.from(await plugin.loadData());
		const cache = await openCache(`depot-cache-${plugin.app.vault.getName()}`);
		const secrets = obsidianSecrets(plugin.app);

		const storages: Storages<Attachment> = new Storages({
			settings,
			storeFor: (profile) => S3ObjectStore.for(profile, { http: obsidianHttp, secrets }),
			attach: (reference, name) => attachments.of(reference, name),
		});
		const resolver = new Resolver({ storeFor: (id) => storages.storeFor(id), cache, objectUrls: browserObjectUrls });
		const attachments = new Attachments({ resolver, recognizes: (id) => storages.recognizes(id) });

		return new Depot(settings, storages, attachments, resolver, cache, (current) => plugin.saveData(current.toJSON()));
	}

	async save(): Promise<void> {
		await this.persist(this.settings);
	}

	async clearCache(): Promise<void> {
		await this.cache.clear();
	}

	release(): void {
		this.resolver.release();
		this.cache.close?.();
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
