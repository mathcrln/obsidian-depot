import { expect, it } from 'vitest';
import type { LibraryItem } from '@/library/library-item';
import { LibraryViewState } from '@/ui/library/library-view-state';

it('resets the broken status tab when the current results contain no broken references', () => {
	const state = new LibraryViewState();
	state.status = 'broken';
	state.setItems([GivenLibraryItem('used', 'used')]);

	expect(state.counts.broken).toBe(0);
	expect(state.status).toBe('all');
	expect(state.visible.map((item) => item.key)).toEqual(['used']);
});

it('keeps the broken status while inventory is temporarily empty', () => {
	const state = new LibraryViewState();
	const broken = GivenLibraryItem('missing', 'broken');
	state.setItems([broken]);
	state.setStatus('broken');
	state.setItems([]);

	expect(state.status).toBe('broken');
	expect(state.visible).toHaveLength(0);
});

it('does not recompute filtered items when selecting one', () => {
	const state = new LibraryViewState();
	const used = GivenLibraryItem('used', 'used');
	state.setItems([used]);
	const visible = state.visible;

	state.select(used);

	expect(state.visible).toBe(visible);
	expect(state.selected).toBe(used);
});

function GivenLibraryItem(key: string, status: LibraryItem['status']): LibraryItem {
	return { profile: 'personal', key, kind: 'image', status, notes: [] };
}
