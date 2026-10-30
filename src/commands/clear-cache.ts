import { Notice } from 'obsidian';
import type DepotPlugin from '@/main';

export function registerClearCacheCommand(plugin: DepotPlugin): void {
	plugin.addCommand({
		id: 'clear-cache',
		name: 'Clear cache',
		callback: async () => {
			await plugin.depot.clearCache();
			new Notice('Cache cleared.');
		},
	});
}
