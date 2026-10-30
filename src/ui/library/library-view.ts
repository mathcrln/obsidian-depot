import { Component, ItemView, MarkdownView, Platform } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type DepotPlugin from '@/main';
import { renderDetails } from '@/ui/library/library-details';
import { createLibraryLayout, type LibraryLayout } from '@/ui/library/library-layout';
import { groupByMonth } from '@/library/library-groups';
import { LibraryLightbox } from '@/ui/library/library-lightbox';
import { libraryFailureMessage, showLibraryEmpty, showLibraryMessage } from '@/ui/library/library-messages';
import { LibraryStatusTabs } from '@/ui/library/library-status-tabs';
import { LibraryGrid } from '@/ui/library/library-tile';
import { LibraryToolbar } from '@/ui/library/library-toolbar';
import { LibraryViewState } from '@/ui/library/library-view-state';
import type { LibraryItem } from '@/library/library-item';

export const LIBRARY_VIEW = 'depot-library';

const COMPACT_WIDTH = 700;

export class LibraryView extends ItemView {
	private readonly state = new LibraryViewState();
	private session: Component | undefined;
	private layout: LibraryLayout | undefined;
	private grid: LibraryGrid | undefined;
	private tabs: LibraryStatusTabs | undefined;
	private details: Component | undefined;
	private loadToken = 0;
	private editor: MarkdownView | undefined;
	private lightbox: LibraryLightbox | undefined;

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
		this.loadToken++;
		this.lightbox?.close();
		this.lightbox = undefined;
		if (this.session !== undefined) this.removeChild(this.session);
		const session = this.addChild(new Component());
		this.session = session;
		const layout = createLibraryLayout(this.contentEl);
		this.layout = layout;
		this.grid = session.addChild(
			new LibraryGrid(
				layout.grid,
				this.plugin.depot,
				(item) => this.select(item),
				(item) => this.openLightbox(item)
			)
		);

		this.editor = this.app.workspace.getActiveViewOfType(MarkdownView) ?? undefined;
		session.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.editor = this.app.workspace.getActiveViewOfType(MarkdownView) ?? this.editor;
			})
		);
		session.registerEvent(this.app.workspace.on('resize', () => this.updateCompact()));
		this.updateCompact();

		this.state.profile = this.plugin.depot.settings.defaultProfile?.id ?? this.plugin.depot.settings.profiles[0]?.id;
		this.renderToolbar();
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.loadToken++;
		this.lightbox?.close();
		this.lightbox = undefined;
		if (this.session !== undefined) this.removeChild(this.session);
		this.session = undefined;
		this.layout = undefined;
		this.grid = undefined;
		this.tabs = undefined;
		this.details = undefined;
	}

	async refresh(): Promise<void> {
		const profile = this.state.profile;
		const token = ++this.loadToken;
		this.state.setItems([]);
		this.showDetails();
		this.renderTabs();
		this.grid?.render([], undefined);

		if (profile === undefined) {
			this.showMessage('Add a storage profile in Settings → Depot to browse its files.');
			return;
		}

		this.showMessage('Loading library…');

		try {
			const items = await this.plugin.depot.library.load(profile);
			if (token !== this.loadToken) return;
			this.state.setItems(items);
		} catch (error) {
			if (token !== this.loadToken) return;
			this.showMessage(libraryFailureMessage(this.plugin.depot.settings, profile, error), true);
			return;
		}

		this.renderGrid();
	}

	private renderToolbar(): void {
		const session = this.session;
		const layout = this.layout;
		if (session === undefined || layout === undefined) return;
		const toolbar = new LibraryToolbar(layout.toolbar, {
			profiles: this.plugin.depot.settings.profiles,
			profile: this.state.profile,
			defaultProfile: this.plugin.depot.settings.defaultProfile?.id,
			query: this.state.query,
			kind: this.state.kind,
			onQuery: (query) => {
				this.state.setQuery(query);
				this.renderGrid();
			},
			onProfile: (profile) => {
				this.state.profile = profile;
				void this.refresh();
			},
			onKind: (kind) => {
				this.state.setKind(kind);
				this.renderGrid();
			},
			onRefresh: () => void this.refresh(),
		});
		session.addChild(toolbar);
	}

	private renderTabs(): void {
		const tabsEl = this.layout?.tabs;
		const session = this.session;
		if (tabsEl === undefined || session === undefined) return;
		if (this.tabs !== undefined) session.removeChild(this.tabs);
		if (this.state.items.length === 0) {
			tabsEl.empty();
			this.tabs = undefined;
			return;
		}
		this.tabs = session.addChild(
			new LibraryStatusTabs(tabsEl, this.state.counts, this.state.status, (status) => {
				this.state.setStatus(status);
				this.renderGrid();
			})
		);
	}

	private renderGrid(): void {
		this.renderTabs();
		const visible = this.state.visible;
		if (this.state.selected !== undefined && !visible.includes(this.state.selected)) {
			this.state.select(undefined);
			this.showDetails();
		}

		if (visible.length === 0) {
			this.grid?.render([], undefined);
			this.showEmpty(this.state.items.length === 0);
			return;
		}

		this.showMessage('');
		this.grid?.render(groupByMonth(visible), this.state.selected);
	}

	private select(item: LibraryItem): void {
		this.state.select(item);
		this.grid?.select(item);
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
		if (this.lightbox !== undefined) return;
		const snapshot = [...this.state.visible];
		this.lightbox = new LibraryLightbox(
			this.app,
			this.plugin.depot,
			snapshot,
			item,
			() => this.currentEditor(),
			(shown) => {
				this.state.select(shown);
				this.grid?.select(shown);
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
		const detailsEl = this.layout?.details;
		const session = this.session;
		if (detailsEl === undefined || session === undefined) return;
		if (this.details !== undefined) session.removeChild(this.details);
		this.details = undefined;
		detailsEl.toggleClass('is-hidden', this.state.selected === undefined);
		detailsEl.empty();
		const item = this.state.selected;
		if (item === undefined) return;

		const details = session.addChild(new Component());
		this.details = details;
		renderDetails(
			detailsEl,
			item,
			this.app,
			this.plugin.depot,
			details,
			() => {
				this.state.select(undefined);
				this.showDetails();
				this.grid?.select(undefined);
			},
			() => this.currentEditor()
		);
	}

	private showEmpty(noFiles: boolean): void {
		if (this.layout !== undefined) showLibraryEmpty(this.layout.message, noFiles);
	}

	private showMessage(text: string, isError = false): void {
		if (this.layout !== undefined) showLibraryMessage(this.layout.message, text, isError);
	}
}
