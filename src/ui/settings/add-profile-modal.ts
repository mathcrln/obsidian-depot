import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';
import { ProfileId } from '@/references/profile-id';
import { DuplicateProfile, type Settings } from '@/models/plugin-settings';

export class AddProfileModal extends Modal {
	private id = '';

	constructor(
		app: App,
		private readonly settings: Settings,
		private readonly onSubmit: (id: string) => Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Add profile');

		let errorEl: HTMLElement;

		const submit = async (): Promise<void> => {
			const problem = this.problem();

			if (problem !== undefined) {
				errorEl.setText(problem);
				return;
			}

			this.close();
			await this.onSubmit(this.id);
		};

		new Setting(this.contentEl)
			.setName('Identifier')
			.setDesc('Lowercase letters, digits, and hyphens, starting with a letter.')
			.addText((text) => {
				text.setPlaceholder('Example: personal').onChange((value) => {
					this.id = value.trim();
					errorEl.setText('');
				});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') void submit();
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		errorEl = this.contentEl.createDiv({ cls: 'depot-form-error' });

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText('Add')
				.setCta()
				.onClick(() => void submit())
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private problem(): string | undefined {
		try {
			ProfileId.parse(this.id);
		} catch (error) {
			return error instanceof Error ? error.message : 'Invalid identifier.';
		}

		return this.settings.profile(this.id) !== undefined ? new DuplicateProfile(this.id).message : undefined;
	}
}
