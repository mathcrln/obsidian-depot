import {
	debounce,
	ItemView,
	MarkdownView,
	Platform,
	SearchComponent,
	setIcon,
	type Debouncer,
	type WorkspaceLeaf,
} from 'obsidian';
import type DepotPlugin from '@/main';
import { renderDetails } from '@/library/library-details';
import { countByStatus, filterLibrary, type KindFilter, type StatusFilter } from '@/library/library-filter';
import { groupByMonth } from '@/library/library-groups';
import { inventoryOf } from '@/library/inventory';
import type { LibraryItem } from '@/library/library-item';
import { LibraryLightbox } from '@/library/library-lightbox';
import { LibraryGrid } from '@/library/library-tile';
import { collectReferenceUses } from '@/library/vault-references';
import { AccessDenied, type ObjectSummary } from '@/storages/object-store';
import { providerOf } from '@/storages/provider';

export const LIBRARY_VIEW = 'depot-library';

const COMPACT_WIDTH = 700;
const SEARCH_DELAY = 200;

const KINDS: [KindFilter, string][] = [
	['all', 'All'],
	['image', 'Images'],
	['pdf', 'PDFs'],
	['audio', 'Audio'],
	['video', 'Video'],
	['other', 'Other'],
];
const STATUSES: [StatusFilter, string][] = [
	['all', 'All'],
	['used', 'Used'],
	['unused', 'Unused'],
	['broken', 'Broken'],
];

export class LibraryView extends ItemView {
	private profile: string | undefined;
	private query = '';
	private kind: KindFilter = 'all';
	private status: StatusFilter = 'all';
	private items: LibraryItem[] = [];
	private visible: LibraryItem[] = [];
	private selected: LibraryItem | undefined;
	private loadToken = 0;
	private editor: MarkdownView | undefined;
	private lightbox: LibraryLightbox | undefined;
	private search: Debouncer<[string], void> | undefined;

	private toolbarEl!: HTMLElement;
	private tabsEl!: HTMLElement;
	private messageEl!: HTMLElement;
	private gridEl!: HTMLElement;
	private detailsEl!: HTMLElement;
	private grid!: LibraryGrid;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: DepotPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return LIBRARY_VIEW;
	}

	getDisplayText(): string {
		return 'Depot library';
	}

	getIcon(): string {
		return 'images';
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('depot-library');

		this.toolbarEl = root.createDiv({ cls: 'depot-library-toolbar' });
		const subbar = root.createDiv({ cls: 'depot-library-subbar' });
		this.tabsEl = subbar.createDiv({ cls: 'depot-library-tabs', attr: { role: 'group', 'aria-label': 'Usage' } });
		subbar.createDiv({ cls: 'depot-library-note', text: 'Unused means not referenced in this vault.' });
		const body = root.createDiv({ cls: 'depot-library-body' });
		const main = body.createDiv({ cls: 'depot-library-main' });
		this.messageEl = main.createDiv({ cls: 'depot-library-message' });
		this.gridEl = main.createDiv({ cls: 'depot-library-sections' });
		this.detailsEl = body.createDiv({ cls: 'depot-library-details is-hidden' });
		this.grid = new LibraryGrid(
			this.gridEl,
			this.plugin.depot,
			(item) => this.select(item),
			(item) => this.openLightbox(item)
		);

		this.editor = this.app.workspace.getActiveViewOfType(MarkdownView) ?? undefined;
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.editor = this.app.workspace.getActiveViewOfType(MarkdownView) ?? this.editor;
			})
		);
		this.registerEvent(this.app.workspace.on('resize', () => this.updateCompact()));
		this.updateCompact();

		this.profile = this.plugin.depot.settings.defaultProfile?.id ?? this.plugin.depot.settings.profiles[0]?.id;
		this.renderToolbar();
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.loadToken++;
		this.search?.cancel();
		this.lightbox?.close();
		this.grid?.dispose();
	}

	async refresh(): Promise<void> {
		const depot = this.plugin.depot;
		const profile = this.profile;
		const token = ++this.loadToken;

		this.selected = undefined;
		this.items = [];
		this.visible = [];
		this.showDetails();
		this.renderTabs();
		this.grid.render([], undefined);

		if (!profile) {
			this.showMessage('Add a storage profile in Settings → Depot to browse its files.');
			return;
		}

		this.showMessage('Loading library…');

		try {
			const [objects, uses] = await Promise.all([this.listObjects(profile), collectReferenceUses(this.app, depot)]);
			if (token !== this.loadToken) return;
			this.items = inventoryOf({ profile, objects, uses: uses.filter((use) => use.profile === profile) });
		} catch (error) {
			if (token !== this.loadToken) return;
			this.showMessage(this.failureMessage(profile, error), { isError: true });
			return;
		}

		this.renderGrid();
	}

	private failureMessage(profile: string, error: unknown): string {
		if (!(error instanceof AccessDenied)) {
			return `Could not load "${profile}": ${error instanceof Error ? error.message : String(error)}`;
		}

		const hints = {
			aws: 'The AWS keys need the s3:ListBucket permission to browse this bucket.',
			r2: 'Check that the R2 token has access to this bucket.',
			other: 'Check that the keys are allowed to list this bucket.',
		};

		return `Access denied for "${profile}". ${hints[providerOf(this.plugin.depot.settings.profile(profile)?.endpoint ?? '')]}`;
	}

	private async listObjects(profile: string): Promise<ObjectSummary[]> {
		const objects: ObjectSummary[] = [];
		for await (const object of this.plugin.depot.storages.storeFor(profile).list()) objects.push(object);
		return objects;
	}

	private renderToolbar(): void {
		const bar = this.toolbarEl;
		bar.empty();

		const search = new SearchComponent(bar.createDiv({ cls: 'depot-library-search' }));
		search.setPlaceholder('Search files or notes…');
		search.setValue(this.query);
		this.search = debounce(
			(query: string) => {
				this.query = query;
				this.renderGrid();
			},
			SEARCH_DELAY,
			true
		);
		search.onChange((query) => this.search?.(query));
		search.inputEl.setAttr('aria-label', 'Search files or notes');

		const settings = this.plugin.depot.settings;
		if (settings.profiles.length > 1) {
			const ordered = [...settings.profiles].sort(
				(a, b) => Number(b.id === settings.defaultProfile?.id) - Number(a.id === settings.defaultProfile?.id)
			);
			const profileSelect = bar.createEl('select', { cls: 'dropdown', attr: { 'aria-label': 'Storage profile' } });
			for (const profile of ordered) profileSelect.createEl('option', { value: profile.id, text: profile.id });
			if (this.profile) profileSelect.value = this.profile;
			profileSelect.addEventListener('change', () => {
				this.profile = profileSelect.value;
				void this.refresh();
			});
		}

		const kindSelect = bar.createEl('select', { cls: 'dropdown', attr: { 'aria-label': 'File kind' } });
		for (const [value, label] of KINDS) kindSelect.createEl('option', { value, text: label });
		kindSelect.value = this.kind;
		kindSelect.addEventListener('change', () => {
			this.kind = kindSelect.value as KindFilter;
			this.renderGrid();
		});

		const refresh = bar.createEl('button', { cls: 'depot-library-refresh', attr: { 'aria-label': 'Refresh library' } });
		setIcon(refresh.createSpan({ cls: 'depot-library-button-icon' }), 'refresh-cw');
		refresh.createSpan({ text: 'Refresh' });
		refresh.addEventListener('click', () => void this.refresh());
	}

	private renderTabs(): void {
		this.tabsEl.empty();
		if (this.items.length === 0) return;

		const counts = countByStatus(this.items, { query: this.query, kind: this.kind });
		if (this.status === 'broken' && counts.broken === 0) this.status = 'all';

		for (const [value, label] of STATUSES) {
			if (value === 'broken' && counts.broken === 0) continue;
			const tab = this.tabsEl.createEl('button', {
				cls: 'depot-library-tab',
				attr: { 'aria-pressed': String(this.status === value) },
			});
			tab.createSpan({ text: label });
			tab.createSpan({ cls: 'depot-library-tab-count', text: String(counts[value]) });
			tab.addEventListener('click', () => {
				this.status = value;
				this.renderGrid();
			});
		}
	}

	private renderGrid(): void {
		this.renderTabs();
		this.visible = filterLibrary(this.items, { query: this.query, kind: this.kind, status: this.status });
		if (this.selected && !this.visible.includes(this.selected)) {
			this.selected = undefined;
			this.showDetails();
		}

		if (this.visible.length === 0) {
			this.grid.render([], undefined);
			this.showEmpty(this.items.length === 0);
			return;
		}

		this.showMessage('');
		this.grid.render(groupByMonth(this.visible), this.selected);
	}

	private select(item: LibraryItem): void {
		this.selected = item;
		this.grid.select(item);
		this.showDetails();
		if (this.isCompact()) this.openLightbox(item);
	}

	private isCompact(): boolean {
		return Platform.isMobile || this.contentEl.clientWidth < COMPACT_WIDTH;
	}

	private updateCompact(): void {
		this.contentEl.toggleClass('is-compact', this.isCompact());
	}

	private openLightbox(item: LibraryItem): void {
		if (this.lightbox) return;

		this.lightbox = new LibraryLightbox(
			this.app,
			this.plugin.depot,
			this.visible,
			item,
			() => this.currentEditor(),
			(shown) => {
				this.selected = shown;
				this.grid.select(shown);
				this.showDetails();
			},
			() => (this.lightbox = undefined)
		);
		this.lightbox.open();
	}

	private currentEditor(): MarkdownView | undefined {
		return this.editor?.leaf.view === this.editor ? this.editor : undefined;
	}

	private showDetails(): void {
		this.detailsEl.toggleClass('is-hidden', !this.selected);
		this.detailsEl.empty();
		if (!this.selected) return;

		renderDetails(
			this.detailsEl,
			this.selected,
			this.app,
			this.plugin.depot,
			() => {
				this.selected = undefined;
				this.showDetails();
				this.grid.select(undefined);
			},
			() => this.currentEditor()
		);
	}

	private showEmpty(noFiles: boolean): void {
		this.messageEl.empty();
		this.messageEl.removeClass('is-error', 'is-hidden');
		const empty = this.messageEl.createDiv({ cls: 'depot-library-empty' });
		setIcon(empty.createDiv({ cls: 'depot-library-empty-icon' }), noFiles ? 'images' : 'search-x');
		empty.createDiv({ cls: 'depot-library-empty-title', text: noFiles ? 'No files yet' : 'No files match your search' });
		empty.createDiv({
			cls: 'depot-library-empty-hint',
			text: noFiles ? 'Files you upload to this profile appear here.' : 'Try different words or another filter.',
		});
	}

	private showMessage(text: string, { isError = false } = {}): void {
		this.messageEl.empty();
		this.messageEl.toggleClass('is-error', isError);
		this.messageEl.toggleClass('is-hidden', text === '');
		this.messageEl.setText(text);
	}
}
