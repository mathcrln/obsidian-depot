import { Notice } from 'obsidian';
import type DepotPlugin from '@/main';
import { ObjectNotFound } from '@/storages/object-store';

export function registerCheckConnectionCommand(plugin: DepotPlugin): void {
	plugin.addCommand({
		id: 'check-connection',
		name: 'Check connection to the default profile',
		callback: async () => {
			const profile = plugin.depot.settings.defaultProfile;
			if (!profile) {
				new Notice('Depot: no default profile is configured.');
				return;
			}

			try {
				await plugin.depot.storages.storeFor(profile.id).head('.depot-connection-check');
				new Notice('Depot: connected.');
			} catch (error) {
				new Notice(
					error instanceof ObjectNotFound
						? 'Depot: connected.'
						: `Depot: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		},
	});
}
