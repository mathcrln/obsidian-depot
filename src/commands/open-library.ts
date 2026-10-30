import type DepotPlugin from '@/main';
import { openLibrary } from '@/ui/library/register-library';

export function registerOpenLibraryCommand(plugin: DepotPlugin): void {
	const open = () => void openLibrary(plugin.app.workspace);
	plugin.addRibbonIcon('images', 'Open Depot library', open);
	plugin.addCommand({ id: 'open-library', name: 'Open library', callback: open });
}
