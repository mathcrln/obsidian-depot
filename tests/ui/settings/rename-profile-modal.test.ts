import { afterEach, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import { Profiles } from '@/actions/profiles';
import { Settings } from '@/models/plugin-settings';
import { RenameProfileModal } from '@/ui/settings/rename-profile-modal';

const formCallbacks = vi.hoisted(() => ({ onChange: undefined as ((value: string) => void) | undefined }));

vi.mock('obsidian', () => ({
	Modal: class Modal {
		contentEl = new FakeElement();
		setTitle(): void {}
		close(): void {
			(this as unknown as { onClose: () => void }).onClose();
		}
	},
	Notice: class Notice {},
	Setting: class Setting {
		setName(): this {
			return this;
		}
		setDesc(): this {
			return this;
		}
		setClass(): this {
			return this;
		}
		addText(
			configure: (text: {
				inputEl: { focus: () => void; addEventListener: () => void };
				setPlaceholder: () => unknown;
				onChange: (callback: (value: string) => void) => unknown;
			}) => void
		): this {
			configure({
				inputEl: { focus: () => {}, addEventListener: () => {} },
				setPlaceholder: () => ({}),
				onChange: (callback) => {
					formCallbacks.onChange = callback;
					return {};
				},
			});
			return this;
		}
		addButton(
			configure: (button: {
				setButtonText: () => unknown;
				setDisabled: () => unknown;
				setCta: () => unknown;
				onClick: () => unknown;
			}) => void
		): this {
			const button = {
				setButtonText() {
					return this;
				},
				setDisabled() {
					return this;
				},
				setCta() {
					return this;
				},
				onClick() {
					return this;
				},
			};
			configure(button);
			return this;
		}
	},
}));
afterEach(() => vi.unstubAllGlobals());

it('shows the reopened scan and ignores an older scan that finishes afterward', async () => {
	const reads: Array<(text: string) => void> = [];
	const file = { path: 'Notes/References.md', extension: 'md' } as unknown as TFile;
	const app = {
		vault: {
			getFiles: () => [file],
			cachedRead: () => new Promise<string>((resolve) => reads.push(resolve)),
		},
	} as unknown as App;
	const settings = Settings.from({ profiles: [{ id: 'personal' }] });
	const modal = new RenameProfileModal(
		{ app, profiles: new Profiles({ app, settings, save: async () => {} }), settings, onChange: () => {} },
		'personal'
	);
	vi.stubGlobal('window', { setTimeout: () => 0, clearTimeout: vi.fn() });

	modal.onOpen();
	const firstContent = modal.contentEl as unknown as FakeElement;
	const firstImpact = firstContent.findByClass('depot-rename-impact');
	expect(reads).toHaveLength(1);

	modal.onClose();
	modal.onOpen();
	const reopenedContent = modal.contentEl as unknown as FakeElement;
	const reopenedImpact = reopenedContent.findByClass('depot-rename-impact');
	const reopenedPreview = reopenedContent.findByClass('depot-rename-preview');
	expect(reads).toHaveLength(2);

	reads[1]?.('personal://fresh/folder/photo.png personal://fresh/folder/other.png');
	await Promise.resolve();
	await Promise.resolve();
	formCallbacks.onChange?.('renamed');
	expect(reopenedImpact.textContent).toContain('2 references in 1 note');
	expect(reopenedPreview.textContent).toContain('fresh/folder/…');

	reads[0]?.('personal://stale/old.png');
	await Promise.resolve();
	await Promise.resolve();

	expect(reopenedImpact.textContent).toContain('2 references in 1 note');
	expect(reopenedImpact.textContent).not.toContain('1 reference in 1 note');
	expect(firstImpact.textContent).toBe('Looking for references…');
});

class FakeElement {
	readonly children: FakeElement[] = [];
	text = '';
	className = '';

	get textContent(): string {
		return this.text + this.children.map((child) => child.textContent).join('');
	}

	empty(): void {
		this.children.splice(0);
		this.text = '';
	}

	createDiv(options?: { cls?: string }): FakeElement {
		return this.append(new FakeElement()).setClassName(options?.cls);
	}

	createEl(_tag: string, options?: { cls?: string; text?: string }): FakeElement {
		const child = this.append(new FakeElement()).setClassName(options?.cls);
		child.text = options?.text ?? '';
		return child;
	}

	appendText(text: string): void {
		this.text += text;
	}

	setText(text: string): void {
		this.empty();
		this.text = text;
	}

	addClass(): void {}
	removeClass(): void {}

	findByClass(className: string): FakeElement {
		const found = this.children.find((child) => child.className === className);
		if (found === undefined) throw new Error(`Could not find ${className}.`);
		return found;
	}

	private append(child: FakeElement): FakeElement {
		this.children.push(child);
		return child;
	}

	private setClassName(className: string | undefined): this {
		this.className = className ?? '';
		return this;
	}
}
