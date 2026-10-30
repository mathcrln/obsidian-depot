import { Component } from 'obsidian';
import type { StatusCounts, StatusFilter } from '@/library/library-filter';

const STATUSES: [StatusFilter, string][] = [
	['all', 'All'],
	['used', 'Used'],
	['unused', 'Unused'],
	['broken', 'Broken'],
];

export class LibraryStatusTabs extends Component {
	constructor(parent: HTMLElement, counts: StatusCounts, status: StatusFilter, onSelect: (status: StatusFilter) => void) {
		super();
		parent.empty();
		for (const [value, label] of STATUSES) {
			if (value === 'broken' && counts.broken === 0) continue;
			const tab = parent.createEl('button', {
				cls: 'depot-library-tab',
				attr: { 'aria-pressed': String(status === value) },
			});
			tab.createSpan({ text: label });
			tab.createSpan({ cls: 'depot-library-tab-count', text: String(counts[value]) });
			this.registerDomEvent(tab, 'click', () => onSelect(value));
		}
	}
}
