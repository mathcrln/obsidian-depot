import { Plugin } from 'obsidian';
import { Commands } from '@/commands/commands';
import { Depot } from '@/depot';
import { BasesCovers } from '@/integrations/bases-covers';
import { WorkspaceObserver } from '@/integrations/workspace-observer';
import { NoteAttachments } from '@/integrations/note-attachments';
import { registerLibrary } from '@/ui/library/register-library';
import { DepotSettingTab } from '@/ui/settings/setting-tab';

export default class DepotPlugin extends Plugin {
	depot!: Depot;

	async onload() {
		this.depot = await Depot.boot(this);

		this.addSettingTab(new DepotSettingTab(this));
		registerLibrary(this);
		Commands.register(this);
		const observer = this.addChild(new WorkspaceObserver(this.app.workspace));
		this.addChild(new NoteAttachments(this, this.depot, observer));
		this.addChild(new BasesCovers(this, this.depot, observer));
	}

	onunload() {
		this.depot.release();
	}
}
