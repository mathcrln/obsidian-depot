export interface LibraryLayout {
	toolbar: HTMLElement;
	tabs: HTMLElement;
	message: HTMLElement;
	grid: HTMLElement;
	details: HTMLElement;
}

export function createLibraryLayout(root: HTMLElement): LibraryLayout {
	root.empty();
	root.addClass('depot-library');
	const toolbar = root.createDiv({ cls: 'depot-library-toolbar' });
	const subbar = root.createDiv({ cls: 'depot-library-subbar' });
	const tabs = subbar.createDiv({ cls: 'depot-library-tabs', attr: { role: 'group', 'aria-label': 'Usage' } });
	subbar.createDiv({ cls: 'depot-library-note', text: 'Unused means not referenced in this vault.' });
	const body = root.createDiv({ cls: 'depot-library-body' });
	const main = body.createDiv({ cls: 'depot-library-main' });
	const message = main.createDiv({ cls: 'depot-library-message' });
	const grid = main.createDiv({ cls: 'depot-library-sections' });
	const details = body.createDiv({ cls: 'depot-library-details is-hidden' });

	return { toolbar, tabs, message, grid, details };
}
