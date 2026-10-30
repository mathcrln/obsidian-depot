import type DepotPlugin from '@/main';
import { LIBRARY_VIEW, LibraryView } from '@/library/library-view';

export function registerLibrary(plugin: DepotPlugin): void {
	plugin.registerView(LIBRARY_VIEW, (leaf) => new LibraryView(leaf, plugin));

	const open = () => void openLibrary(plugin);

	plugin.addRibbonIcon('images', 'Open Depot library', open);
	plugin.addCommand({ id: 'open-library', name: 'Open library', callback: open });
}

async function openLibrary(plugin: DepotPlugin): Promise<void> {
	const { workspace } = plugin.app;
	const leaf = workspace.getLeavesOfType(LIBRARY_VIEW)[0] ?? workspace.getLeaf('tab');

	await leaf.setViewState({ type: LIBRARY_VIEW, active: true });
	await workspace.revealLeaf(leaf);
}
