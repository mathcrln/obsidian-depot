import { Component, debounce, SearchComponent, setIcon, type Debouncer } from 'obsidian';
import type { ProfileSettings } from '@/models/plugin-settings';
import type { KindFilter } from '@/library/library-filter';

const SEARCH_DELAY = 200;

export interface LibraryToolbarOptions {
	profiles: readonly ProfileSettings[];
	profile: string | undefined;
	defaultProfile: string | undefined;
	query: string;
	kind: KindFilter;
	onQuery: (query: string) => void;
	onProfile: (profile: string) => void;
	onKind: (kind: KindFilter) => void;
	onRefresh: () => void;
}

export class LibraryToolbar extends Component {
	private search: Debouncer<[string], void> | undefined;

	constructor(parent: HTMLElement, options: LibraryToolbarOptions) {
		super();
		const bar = parent;
		const search = new SearchComponent(bar.createDiv({ cls: 'depot-library-search' }));
		search.setPlaceholder('Search files or notes…');
		search.setValue(options.query);
		search.inputEl.setAttr('aria-label', 'Search files or notes');
		this.search = debounce(options.onQuery, SEARCH_DELAY, true);
		search.onChange((query) => this.search?.(query));
		this.register(() => {
			search.onChange(() => {});
			this.search?.cancel();
		});

		if (options.profiles.length > 1) {
			const ordered = [...options.profiles].sort(
				(a, b) => Number(b.id === options.defaultProfile) - Number(a.id === options.defaultProfile)
			);
			const profileSelect = bar.createEl('select', { cls: 'dropdown', attr: { 'aria-label': 'Storage profile' } });
			for (const profile of ordered) profileSelect.createEl('option', { value: profile.id, text: profile.id });
			if (options.profile !== undefined) profileSelect.value = options.profile;
			this.registerDomEvent(profileSelect, 'change', () => options.onProfile(profileSelect.value));
		}

		const kindSelect = bar.createEl('select', { cls: 'dropdown', attr: { 'aria-label': 'File kind' } });
		for (const [value, label] of KINDS) kindSelect.createEl('option', { value, text: label });
		kindSelect.value = options.kind;
		this.registerDomEvent(kindSelect, 'change', () => options.onKind(kindSelect.value as KindFilter));

		const refresh = bar.createEl('button', { cls: 'depot-library-refresh', attr: { 'aria-label': 'Refresh library' } });
		setRefreshIcon(refresh);
		refresh.createSpan({ text: 'Refresh' });
		this.registerDomEvent(refresh, 'click', options.onRefresh);
	}
}

const KINDS: [KindFilter, string][] = [
	['all', 'All'],
	['image', 'Images'],
	['pdf', 'PDFs'],
	['audio', 'Audio'],
	['video', 'Video'],
	['other', 'Other'],
];

function setRefreshIcon(button: HTMLElement): void {
	const icon = button.createSpan({ cls: 'depot-library-button-icon' });
	setIcon(icon, 'refresh-cw');
}
