import type DepotPlugin from '@/main';
import type { Workspace } from 'obsidian';
import { LIBRARY_VIEW, LibraryView } from '@/ui/library/library-view';

export function registerLibrary(plugin: DepotPlugin): void {
	plugin.registerView(LIBRARY_VIEW, (leaf) => new LibraryView(leaf, plugin));
}

export async function openLibrary(workspace: Workspace): Promise<void> {
	const leaf = workspace.getLeavesOfType(LIBRARY_VIEW)[0] ?? workspace.getLeaf('tab');

	await leaf.setViewState({ type: LIBRARY_VIEW, active: true });
	await workspace.revealLeaf(leaf);
}
