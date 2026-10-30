import { Modal, Notice, Setting } from 'obsidian';
import type { App } from 'obsidian';
import { ProfileId } from '@/references/profile-id';
import { findReferences, plural, updateReferences } from '@/settings/reference-updates';
import type { Found } from '@/settings/reference-updates';
import { DuplicateProfile, type Settings } from '@/settings/settings';

const VISIBLE_NOTES = 50;

export interface RenameProfileOptions {
	app: App;
	settings: Settings;
	save: () => Promise<void>;
	onChange: () => void;
}

export class RenameProfileModal extends Modal {
	private to = '';
	private found: Found | undefined;
	private busy = false;
	private errorEl!: HTMLElement;
	private previewEl!: HTMLElement;
	private impactEl!: HTMLElement;
	private actionsEl!: HTMLElement;

	constructor(
		private readonly options: RenameProfileOptions,
		private readonly from: string
	) {
		super(options.app);
	}

	onOpen(): void {
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
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		this.errorEl = this.contentEl.createDiv({ cls: 'depot-form-error' });
		this.previewEl = this.contentEl.createDiv({ cls: 'depot-rename-preview' });
		this.impactEl = this.contentEl.createDiv({ cls: 'depot-rename-impact' });
		this.actionsEl = this.contentEl.createDiv({ cls: 'depot-rename-actions' });

		this.impactEl.setText('Looking for references…');
		this.refresh();
		void this.scan();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async scan(): Promise<void> {
		this.found = await findReferences(this.options.app, this.from);
		this.showImpact(this.found);
		this.refresh();
	}

	private showImpact({ affected, references }: Found): void {
		this.impactEl.empty();

		if (affected.length === 0) {
			this.impactEl.createEl('p', { text: `No notes use ${this.from}:// yet.` });
			return;
		}

		const summary = this.impactEl.createEl('p');
		summary.createEl('strong', { text: `${plural(references, 'reference')} in ${plural(affected.length, 'note')}` });
		summary.appendText(` use ${this.from}://.`);

		const details = this.impactEl.createEl('details', { cls: 'depot-rename-notes' });
		details.createEl('summary', { text: 'Show notes' });

		const list = details.createEl('ul');

		for (const { file } of affected.slice(0, VISIBLE_NOTES)) {
			list.createEl('li', { text: file.path });
		}

		if (affected.length > VISIBLE_NOTES) {
			list.createEl('li', { text: `and ${affected.length - VISIBLE_NOTES} more` });
		}
	}

	private refresh(): void {
		const problem = this.to === '' ? undefined : this.problem();

		this.errorEl.setText(problem ?? '');
		this.previewEl.empty();

		if (this.to !== '' && problem === undefined) {
			this.previewEl.appendText('References will look like ');
			this.previewEl.createEl('code', { text: `${this.to}://${this.found?.sample ?? '…'}` });
		}

		this.renderActions();
	}

	private renderActions(): void {
		this.actionsEl.empty();

		const valid = this.to !== '' && this.problem() === undefined && !this.busy;
		const affected = this.found?.affected ?? [];
		const row = new Setting(this.actionsEl).setClass('depot-rename-buttons');
		const add = (label: string, onClick: () => void, cta = false, enabled = valid): void => {
			row.addButton((button) => {
				button.setButtonText(label).setDisabled(!enabled).onClick(onClick);
				if (cta) button.setCta();
			});
		};

		if (affected.length > 0) {
			add(`Rename and update ${plural(affected.length, 'note')}`, () => void this.submit(true), true);
			add('Rename only', () => void this.submit(false));
		} else {
			add('Rename', () => void this.submit(false), true, valid && this.found !== undefined);
		}

		add('Cancel', () => this.close(), false, !this.busy);

		if (affected.length > 0) {
			const help = this.actionsEl.createDiv({ cls: 'depot-rename-help' });

			help.appendText('Rename only: your notes stay the same, and old references still work.');
		}
	}

	private async submit(update: boolean): Promise<void> {
		if (this.busy || this.found === undefined || this.to === '' || this.problem() !== undefined) return;

		const { settings, save, app } = this.options;
		const { from, to } = this;
		const { affected } = this.found;

		this.busy = true;
		this.renderActions();

		settings.renameProfile(from, to);
		await save();

		if (!update || affected.length === 0) {
			this.options.onChange();
			this.close();
			new Notice(
				affected.length === 0 ? `Renamed ${from} to ${to}.` : `Renamed ${from} to ${to}. Old references still work.`
			);
			return;
		}

		this.impactEl.setText(`Updating notes… (0/${affected.length})`);

		const result = await updateReferences(app, affected, from, to, (done, total) =>
			this.impactEl.setText(`Updating notes… (${done}/${total})`)
		);

		if (result.failed === 0) {
			settings.forgetAlias(to, from);
			await save();
		}

		this.options.onChange();
		this.close();
		new Notice(
			result.failed === 0
				? `Updated ${plural(result.references, 'reference')} in ${plural(result.notes, 'note')}.`
				: `Could not update ${plural(result.failed, 'note')}. Old references still work.`
		);
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
