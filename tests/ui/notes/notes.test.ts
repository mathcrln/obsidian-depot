import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notes } from '@/ui/notes/notes';
import type { UploadableFile } from '@/storages/profile';

const notices = vi.hoisted(() => [] as Array<{ text: string; hidden: boolean }>);
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
}));
beforeEach(() => {
	notices.splice(0);
});

describe('Notes', () => {
	it('uploads a batch into a bound note with one reference per line', async () => {
		const { notes, uploaded, contexts } = GivenNotes();
		const editor = GivenEditor();

		await notes.in(editor, { file: { basename: 'My note' } }).upload([GivenFile('one.png'), GivenFile('two.png')]);

		expect(uploaded).toEqual(['one.png', 'two.png']);
		expect(contexts).toEqual([{ note: 'My note' }, { note: 'My note' }]);
		expect(editor.inserted).toEqual(['main://one.png\n', 'main://two.png\n']);
		expect(notices).toEqual([
			{ text: 'Uploading one.png…', hidden: true },
			{ text: 'Uploading two.png…', hidden: true },
		]);
	});

	it('tells the user when an existing upload was reused', async () => {
		const { notes } = GivenNotes({ reusedFile: 'one.png' });
		const editor = GivenEditor();

		await notes.in(editor).upload([GivenFile('one.png')]);

		expect(editor.inserted).toEqual(['main://one.png']);
		expect(notices).toEqual([
			{ text: 'Uploading one.png…', hidden: true },
			{ text: 'Already uploaded — reused the existing file.', hidden: false },
		]);
	});

	it('shows an upload failure without inserting it and continues the batch', async () => {
		const { notes } = GivenNotes({ failedFile: 'bad.png' });
		const editor = GivenEditor();

		await notes.in(editor).upload([GivenFile('bad.png'), GivenFile('good.png')]);

		expect(editor.inserted).toEqual(['main://good.png\n']);
		expect(notices).toContainEqual({ text: 'Could not upload bad.png: Offline', hidden: false });
		expect(notices.filter((notice) => notice.text.startsWith('Uploading')).every((notice) => notice.hidden)).toBe(true);
	});

	it('inserts a single upload without a trailing newline when no note is bound', async () => {
		const { notes, contexts } = GivenNotes();
		const editor = GivenEditor();

		await notes.in(editor).upload([GivenFile('file.png')]);

		expect(editor.inserted).toEqual(['main://file.png']);
		expect(contexts).toEqual([{}]);
	});

	it('inserts an existing attachment without uploading it', () => {
		const { notes, uploaded } = GivenNotes();
		const editor = GivenEditor();

		notes.in(editor).insert({ markdown: () => 'main://existing.png' });

		expect(editor.inserted).toEqual(['main://existing.png']);
		expect(uploaded).toEqual([]);
		expect(notices).toEqual([]);
	});

	it('reports an editor insertion failure and still uploads the next file', async () => {
		const { notes, uploaded } = GivenNotes();
		const editor = GivenEditor('main://one.png\n');

		await notes.in(editor).upload([GivenFile('one.png'), GivenFile('two.png')]);

		expect(uploaded).toEqual(['one.png', 'two.png']);
		expect(editor.inserted).toEqual(['main://two.png\n']);
		expect(notices).toContainEqual({ text: 'Could not upload one.png: Editor unavailable', hidden: false });
		expect(notices.filter((notice) => notice.text.startsWith('Uploading')).every((notice) => notice.hidden)).toBe(true);
	});
});

function GivenNotes({ reusedFile, failedFile }: { reusedFile?: string; failedFile?: string } = {}) {
	const uploaded: string[] = [];
	const contexts: Array<{ note?: string }> = [];
	const notes = new Notes(async (file, context) => {
		uploaded.push(file.name);
		contexts.push(context);
		if (file.name === failedFile) throw new Error('Offline');
		return { attachment: { markdown: () => `main://${file.name}` }, reused: file.name === reusedFile };
	});

	return { notes, uploaded, contexts };
}

function GivenEditor(failingText?: string) {
	const inserted: string[] = [];
	return {
		inserted,
		replaceSelection(text: string): void {
			if (text === failingText) throw new Error('Editor unavailable');
			inserted.push(text);
		},
	};
}

function GivenFile(name: string): UploadableFile {
	return { name, arrayBuffer: async () => new ArrayBuffer(0) };
}
