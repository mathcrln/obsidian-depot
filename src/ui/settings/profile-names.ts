import { Str } from '@/utils/str';
import { Notice } from 'obsidian';
import type { Setting, SettingDefinition } from 'obsidian';
import type { Profiles } from '@/actions/profiles';
import type { PreviousAliasesUpdate } from '@/actions/update-profile-references';
import type { Settings } from '@/models/plugin-settings';

interface ProfileNamesHost {
	settings: () => Settings;
	profiles: Profiles;
	rename: (id: string) => void;
	refresh: () => void;
}

export function profileNameSettings(id: string, host: ProfileNamesHost): SettingDefinition[] {
	const aliases = host.settings().profile(id)?.aliases ?? [];
	const rows: SettingDefinition[] = [renameRow(id, host)];

	if (aliases.length > 0) rows.push(previousNamesRow(id, aliases, host));

	return rows;
}

function renameRow(id: string, host: ProfileNamesHost): SettingDefinition {
	return {
		name: 'Rename profile',
		desc: 'References in your notes use this name.',
		render: (setting: Setting) => {
			const desc = createFragment();
			desc.appendText('References in your notes use this name, like ');
			desc.createEl('code', { text: `${id}://…` });
			desc.appendText('.');
			setting
				.setName('Rename profile')
				.setDesc(desc)
				.addButton((button) => button.setButtonText('Rename…').onClick(() => host.rename(id)));
		},
	};
}

function previousNamesRow(id: string, aliases: string[], host: ProfileNamesHost): SettingDefinition {
	return {
		name: 'Previous names',
		desc: 'Old references still work.',
		render: (setting: Setting) => {
			const desc = createFragment();
			desc.appendText('Old references using ');
			aliases.forEach((alias, index) => {
				if (index > 0) desc.appendText(', ');
				desc.createEl('code', { text: alias });
			});
			desc.appendText(' still work.');
			setting
				.setName('Previous names')
				.setDesc(desc)
				.addButton((button) =>
					button.setButtonText('Update notes').onClick(async () => {
						button.setDisabled(true);
						const result = await host.profiles.updatePreviousReferences(id);
						host.refresh();
						showAliasUpdateNotice(result, aliases);
					})
				);
		},
	};
}

function showAliasUpdateNotice(result: PreviousAliasesUpdate, aliases: string[]): void {
	if (result.failed > 0) {
		new Notice(`Could not update ${Str.quantity(result.failed, 'note')}. Older references keep working.`);
	} else if (result.references === 0 && result.removedAliases.length === aliases.length) {
		new Notice(`No notes used ${result.removedAliases.join(', ')} — removed ${aliases.length === 1 ? 'it' : 'them'}.`);
	} else {
		new Notice(`Updated ${Str.quantity(result.references, 'reference')} in ${Str.quantity(result.notes, 'note')}.`);
	}
}
