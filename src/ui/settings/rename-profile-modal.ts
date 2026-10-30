import { Str } from '@/utils/str';
import { Modal, Notice, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type { Profiles } from '@/actions/profiles';
import type { Found, Affected } from '@/queries/find-profile-references';
import { ProfileId } from '@/references/profile-id';
import { DuplicateProfile, type Settings } from '@/models/plugin-settings';

const VISIBLE_NOTES = 50;

export interface RenameProfileOptions {
	app: App;
	profiles: Profiles;
	settings: Settings;
	onChange: () => void;
}

export class RenameProfileModal extends Modal {
	private to = '';
	private found: Found | undefined;
	private busy = false;
	private opened = false;
	private scanId = 0;
	private focusTimeout: number | undefined;
	private errorEl: HTMLElement | undefined;
	private previewEl: HTMLElement | undefined;
	private impactEl: HTMLElement | undefined;
	private actionsEl: HTMLElement | undefined;

	constructor(
		private readonly options: RenameProfileOptions,
		private readonly from: string
	) {
		super(options.app);
	}

	onOpen(): void {
		this.opened = true;
		const scanId = ++this.scanId;
		this.to = '';
		this.found = undefined;
		this.busy = false;
		this.contentEl.empty();
		this.setTitle(`Rename profile “${this.from}”`);

		new Setting(this.contentEl)
			.setName('New name')
			.setDesc('Lowercase letters, digits, and hyphens, starting with a letter.')
			.addText((text) => {
				text.onChange((value) => {
					this.to = value.trim();
					this.refresh();
				});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') void this.submit(this.found !== undefined && this.found.affected.length > 0);
				});
				this.focusTimeout = window.setTimeout(() => {
					if (this.opened) text.inputEl.focus();
				}, 0);
			});

		this.errorEl = this.contentEl.createDiv({ cls: 'depot-form-error' });
		this.previewEl = this.contentEl.createDiv({ cls: 'depot-rename-preview' });
		this.impactEl = this.contentEl.createDiv({ cls: 'depot-rename-impact' });
		this.actionsEl = this.contentEl.createDiv({ cls: 'depot-rename-actions' });
		this.impactEl.setText('Looking for references…');
		this.refresh();
		void this.scan(scanId);
	}

	onClose(): void {
		this.opened = false;
		this.scanId += 1;
		if (this.focusTimeout !== undefined) window.clearTimeout(this.focusTimeout);
		this.focusTimeout = undefined;
		this.errorEl = undefined;
		this.previewEl = undefined;
		this.impactEl = undefined;
		this.actionsEl = undefined;
		this.contentEl.empty();
	}

	private async scan(scanId: number): Promise<void> {
		const found = await this.options.profiles.previewRename(this.from);
		if (!this.opened || scanId !== this.scanId) return;

		this.found = found;
		this.showImpact(found);
		this.refresh();
	}

	private showImpact({ affected, references }: Found): void {
		const impactEl = this.impactEl;
		if (impactEl === undefined) return;
		impactEl.empty();

		if (affected.length === 0) {
			impactEl.createEl('p', { text: `No notes use ${this.from}:// yet.` });
			return;
		}

		const summary = impactEl.createEl('p');
		summary.createEl('strong', {
			text: `${Str.quantity(references, 'reference')} in ${Str.quantity(affected.length, 'note')}`,
		});
		summary.appendText(` use ${this.from}://.`);

		const details = impactEl.createEl('details', { cls: 'depot-rename-notes' });
		details.createEl('summary', { text: 'Show notes' });
		const list = details.createEl('ul');
		for (const { file } of affected.slice(0, VISIBLE_NOTES)) list.createEl('li', { text: file.path });
		if (affected.length > VISIBLE_NOTES) list.createEl('li', { text: `and ${affected.length - VISIBLE_NOTES} more` });
	}

	private refresh(): void {
		const problem = this.to === '' ? undefined : this.problem();
		this.errorEl?.setText(problem ?? '');
		this.previewEl?.empty();

		if (this.to !== '' && problem === undefined) {
			this.previewEl?.appendText('References will look like ');
			this.previewEl?.createEl('code', { text: `${this.to}://${this.found?.sample ?? '…'}` });
		}

		this.renderActions();
	}

	private renderActions(): void {
		const actionsEl = this.actionsEl;
		if (actionsEl === undefined) return;
		actionsEl.empty();
		const valid = this.to !== '' && this.problem() === undefined && !this.busy;
		const affected = this.found?.affected ?? [];
		const row = new Setting(actionsEl).setClass('depot-rename-buttons');
		const add = (label: string, onClick: () => void, cta = false, enabled = valid): void => {
			row.addButton((button) => {
				button.setButtonText(label).setDisabled(!enabled).onClick(onClick);
				if (cta) button.setCta();
			});
		};

		if (affected.length > 0) {
			add(`Rename and update ${Str.quantity(affected.length, 'note')}`, () => void this.submit(true), true);
			add('Rename only', () => void this.submit(false));
		} else {
			add('Rename', () => void this.submit(false), true, valid && this.found !== undefined);
		}

		add('Cancel', () => this.close(), false, !this.busy);
		if (affected.length > 0) {
			actionsEl
				.createDiv({ cls: 'depot-rename-help' })
				.appendText('Rename only: your notes stay the same, and old references still work.');
		}
	}

	private async submit(update: boolean): Promise<void> {
		const found = this.found;
		if (this.busy || found === undefined || this.to === '' || this.problem() !== undefined) return;

		const { from, to } = this;
		const affected: Affected[] = found.affected;
		this.busy = true;
		this.renderActions();
		if (update && affected.length > 0) this.impactEl?.setText(`Updating notes… (0/${affected.length})`);

		try {
			const result = await this.options.profiles.rename(
				from,
				to,
				update && affected.length > 0
					? {
							references: 'update',
							affected,
							onProgress: (done, total) => this.impactEl?.setText(`Updating notes… (${done}/${total})`),
						}
					: { references: 'keep' }
			);
			this.options.onChange();
			this.close();
			new Notice(
				update && affected.length > 0
					? result.failed === 0
						? `Updated ${Str.quantity(result.references, 'reference')} in ${Str.quantity(result.notes, 'note')}.`
						: `Could not update ${Str.quantity(result.failed, 'note')}. Old references still work.`
					: affected.length === 0
						? `Renamed ${from} to ${to}.`
						: `Renamed ${from} to ${to}. Old references still work.`
			);
		} catch (error) {
			this.options.onChange();
			this.close();
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private problem(): string | undefined {
		if (this.to === this.from) return 'That’s the current name.';

		try {
			ProfileId.parse(this.to);
		} catch (error) {
			return error instanceof Error ? error.message : 'Invalid identifier.';
		}

		const owner = this.options.settings.profileFor(this.to);
		const self = this.options.settings.profileFor(this.from);

		return owner !== undefined && owner !== self ? new DuplicateProfile(this.to).message : undefined;
	}
}
