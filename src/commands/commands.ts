import type DepotPlugin from '@/main';
import { registerClearCacheCommand } from '@/commands/clear-cache';
import { registerOpenLibraryCommand } from '@/commands/open-library';
import { registerUploadCommand } from '@/commands/upload-attachment';

export class Commands {
	static register(plugin: DepotPlugin): void {
		registerUploadCommand(plugin);
		registerClearCacheCommand(plugin);
		registerOpenLibraryCommand(plugin);
	}
}
