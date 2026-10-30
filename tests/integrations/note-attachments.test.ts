import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plugin, TFile } from 'obsidian';
import { Notes } from '@/ui/notes/notes';
import { NoteAttachments } from '@/integrations/note-attachments';
import type { Depot } from '@/depot';
import type { WorkspaceObserver } from '@/integrations/workspace-observer';
import type { UploadFile } from '@/actions/upload-attachments';
import type { InsertableAttachment } from '@/ui/notes/note-editor';
import type { UploadableFile } from '@/storages/profile';

const notices = vi.hoisted(() => [] as Array<{ text: string; hidden: boolean }>);
const postProcessors = vi.hoisted(() => new Set<unknown>());
vi.mock('obsidian', () => ({
	Notice: class Notice {
		readonly state: { text: string; hidden: boolean };
		constructor(text: string) {
			this.state = { text, hidden: false };
			notices.push(this.state);
		}
		hide(): void {
			this.state.hidden = true;
		}
	},
	Component: class {
		private readonly disposers: Array<() => void> = [];
		load(): void {
			this.onload();
		}
		unload(): void {
			this.onunload();
			for (const dispose of this.disposers.splice(0)) dispose();
		}
		onload(): void {}
		onunload(): void {}
		register(dispose: () => void): void {
			this.disposers.push(dispose);
		}
		registerEvent(ref: { unload: () => void }): void {
			this.register(() => ref.unload());
		}
	},
}));

beforeEach(() => {
	notices.splice(0);
	postProcessors.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('NoteAttachments', () => {
	it('does not register listeners in its constructor', () => {
		const plugin = GivenPlugin();

		new NoteAttachments(
			plugin.value,
			GivenDepot(GivenUpload([])),
			new FakeWorkspaceObserver() as unknown as WorkspaceObserver
		);

		expect(plugin.events).not.toHaveBeenCalled();
		expect(postProcessors.size).toBe(0);
	});

	it.each([
		{ name: 'paste', eventName: 'editor-paste', transfer: 'clipboardData' },
		{ name: 'drop', eventName: 'editor-drop', transfer: 'dataTransfer' },
	] as const)('uploads a $name into the current note', async ({ eventName, transfer }) => {
		const inserted: string[] = [];
		const uploads: string[] = [];
		const fixture = GivenNoteAttachments(GivenUpload(uploads));
		const editor = { replaceSelection: (markdown: string) => inserted.push(markdown) };
		const note = GivenNote('My note');
		const event = GivenEditorEvent(transfer, [GivenFile(`${eventName}.png`)]);

		fixture.events.get(eventName)?.(event.value, editor, { file: note });

		expect(event.preventDefault).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(inserted).toEqual([`s3://${eventName}.png`]));
		expect(uploads).toEqual([`${eventName}.png:My note`]);
		expect(notices).toEqual([{ text: `Uploading ${eventName}.png…`, hidden: true }]);
		fixture.component.unload();
	});

	it.each([
		{ name: 'paste', eventName: 'editor-paste', transfer: 'clipboardData' },
		{ name: 'drop', eventName: 'editor-drop', transfer: 'dataTransfer' },
	] as const)('leaves an already handled $name event alone', ({ eventName, transfer }) => {
		const uploads: string[] = [];
		const fixture = GivenNoteAttachments(GivenUpload(uploads));
		const event = GivenEditorEvent(transfer, [GivenFile('image.png')], true);

		fixture.events.get(eventName)?.(event.value, { replaceSelection: () => {} }, { file: GivenNote('Note') });

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(uploads).toEqual([]);
		fixture.component.unload();
	});

	it.each([
		{ name: 'paste', eventName: 'editor-paste', transfer: 'clipboardData' },
		{ name: 'drop', eventName: 'editor-drop', transfer: 'dataTransfer' },
	] as const)('ignores a $name with no files', ({ eventName, transfer }) => {
		const uploads: string[] = [];
		const fixture = GivenNoteAttachments(GivenUpload(uploads));
		const event = GivenEditorEvent(transfer, []);

		fixture.events.get(eventName)?.(event.value, { replaceSelection: () => {} }, { file: GivenNote('Note') });

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(uploads).toEqual([]);
		fixture.component.unload();
	});

	it('renders attachments in elements reported by the workspace observer', () => {
		const fixture = GivenNoteAttachments(GivenUpload([]));
		const added = new FakeElement();

		fixture.observer.render(added as unknown as HTMLElement);

		expect(added.querySelectorAll).toHaveBeenCalledTimes(3);
		fixture.component.unload();
	});

	it('stops listening to the workspace observer when unloaded', () => {
		const fixture = GivenNoteAttachments(GivenUpload([]));
		expect(fixture.observer.subscribers).toBe(1);

		fixture.component.unload();

		expect(fixture.observer.subscribers).toBe(0);
	});

	it('renders attachments in reading view through the plugin post processor', () => {
		const fixture = GivenNoteAttachments(GivenUpload([]));
		const processor = [...postProcessors][0] as (element: HTMLElement) => void;

		processor(fixture.root as unknown as HTMLElement);

		expect(postProcessors.size).toBe(1);
		expect(fixture.root.querySelectorAll).toHaveBeenCalledTimes(3);
		fixture.component.unload();
	});
});

function GivenPlugin() {
	const events = vi.fn();
	return {
		value: { app: { workspace: { on: events } } } as unknown as Plugin,
		events,
	};
}

function GivenNoteAttachments(upload: UploadFile<InsertableAttachment>) {
	const callbacks = new Map<string, EditorEventHandler>();
	const root = new FakeElement();
	const unsubscribe = vi.fn();
	const plugin = {
		app: {
			workspace: {
				on: (name: string, callback: EditorEventHandler) => {
					callbacks.set(name, callback);
					return { unload: unsubscribe };
				},
			},
		},
		registerMarkdownPostProcessor: (processor: unknown) => postProcessors.add(processor),
	};
	const observer = new FakeWorkspaceObserver();
	vi.stubGlobal('HTMLElement', FakeElement);
	const component = new NoteAttachments(
		plugin as unknown as Plugin,
		GivenDepot(upload),
		observer as unknown as WorkspaceObserver
	);
	component.load();

	return { component, events: callbacks, observer, root };
}

function GivenDepot(upload: UploadFile<InsertableAttachment>): Depot {
	return { notes: new Notes(upload), attachments: { from: () => undefined } } as unknown as Depot;
}

function GivenUpload(uploads: string[]): UploadFile<InsertableAttachment> {
	return async (file, context) => {
		uploads.push(`${file.name}:${context.note}`);
		return { attachment: { markdown: () => `s3://${file.name}` }, reused: false };
	};
}

function GivenFile(name: string): UploadableFile {
	return { name, arrayBuffer: async () => new ArrayBuffer(0) };
}

function GivenNote(basename: string): Pick<TFile, 'basename'> {
	return { basename };
}

function GivenEditorEvent(transfer: 'clipboardData' | 'dataTransfer', files: UploadableFile[], defaultPrevented = false) {
	const preventDefault = vi.fn();
	const value = { [transfer]: { files }, defaultPrevented, preventDefault } as unknown as EditorEvent;
	return { value, preventDefault };
}

type EditorEvent = {
	clipboardData?: { files: UploadableFile[] } | null;
	dataTransfer?: { files: UploadableFile[] } | null;
	defaultPrevented: boolean;
	preventDefault(): void;
};

type EditorEventHandler = (
	event: EditorEvent,
	editor: { replaceSelection(markdown: string): void },
	info: { file: Pick<TFile, 'basename'> | null }
) => void;

class FakeWorkspaceObserver {
	private renderer: ((element: HTMLElement) => void) | undefined;

	get subscribers(): number {
		return this.renderer ? 1 : 0;
	}

	subscribe(render: (element: HTMLElement) => void): () => void {
		this.renderer = render;
		return () => {
			this.renderer = undefined;
		};
	}

	render(element: HTMLElement): void {
		this.renderer?.(element);
	}
}

class FakeElement {
	matches = vi.fn(() => false);
	querySelectorAll = vi.fn(() => []);
	instanceOf(): boolean {
		return true;
	}
}
