import { describe, expect, it } from 'vitest';
import { uploadAttachments, type UploadEvent } from '@/actions/upload-attachments';
import type { UploadableFile } from '@/storages/profile';

describe('uploadAttachments', () => {
	it('reports each start before uploading and yields results in input order', async () => {
		const files = [GivenFile('one.png'), GivenFile('two.pdf')];
		const calls: string[] = [];
		const events: UploadEvent<string>[] = [];

		for await (const event of uploadAttachments({
			files,
			context: { note: 'My note' },
			upload: async (file, context) => {
				calls.push(`${file.name}:${context.note}`);
				expect(events[events.length - 1]).toMatchObject({ type: 'started', file });
				return { attachment: file.name, reused: file.name === 'two.pdf' };
			},
		})) {
			events.push(event);
		}

		expect(calls).toEqual(['one.png:My note', 'two.pdf:My note']);
		expect(events).toEqual([
			{ type: 'started', file: files[0] },
			{ type: 'uploaded', file: files[0], attachment: 'one.png', reused: false },
			{ type: 'started', file: files[1] },
			{ type: 'uploaded', file: files[1], attachment: 'two.pdf', reused: true },
		]);
	});

	it('reports a failed file and continues with the next file', async () => {
		const files = [GivenFile('bad.png'), GivenFile('good.png')];
		const failure = new Error('Access denied');
		const events: UploadEvent<string>[] = [];

		for await (const event of uploadAttachments({
			files,
			upload: async (file) => {
				if (file.name === 'bad.png') throw failure;
				return { attachment: file.name, reused: false };
			},
		})) {
			events.push(event);
		}

		expect(events).toEqual([
			{ type: 'started', file: files[0] },
			{ type: 'failed', file: files[0], error: failure },
			{ type: 'started', file: files[1] },
			{ type: 'uploaded', file: files[1], attachment: 'good.png', reused: false },
		]);
	});

	it('does no upload work for an empty batch', async () => {
		let calls = 0;
		const events: UploadEvent<string>[] = [];

		for await (const event of uploadAttachments({
			files: [],
			upload: async () => {
				calls++;
				return { attachment: 'unexpected', reused: false };
			},
		}))
			events.push(event);

		expect(events).toEqual([]);
		expect(calls).toBe(0);
	});
});

function GivenFile(name: string): UploadableFile {
	return { name, arrayBuffer: async () => new ArrayBuffer(0) };
}
