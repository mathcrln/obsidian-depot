import { describe, expect, it, vi } from 'vitest';
import { Attachment } from '@/attachments/attachment';
import type { Resolver } from '@/attachments/resolver';
import { AttachmentReference } from '@/references/attachment-reference';

describe('Attachment', () => {
	it.each(['png', 'pdf', 'mp3', 'mp4'])('embeds .%s files', (extension) => {
		const attachment = GivenAttachment(`attachments/01K.${extension}`);

		expect(attachment.markdown()).toBe(`![](work://attachments/01K.${extension})`);
	});

	it('links other files by name', () => {
		const attachment = GivenAttachment('attachments/report.zip');

		expect(attachment.markdown()).toBe('[report.zip](work://attachments/report.zip)');
	});

	it('escapes brackets in the link name', () => {
		const attachment = GivenAttachment('attachments/x.zip', 'a [b] c.zip');

		expect(attachment.markdown()).toBe('[a \\[b\\] c.zip](work://attachments/x.zip)');
	});

	it('defaults the name to the last key segment', () => {
		expect(GivenAttachment('attachments/deep/report.zip').name).toBe('report.zip');
	});

	it('exposes its kind', () => {
		expect(GivenAttachment('attachments/a.png').kind).toBe('image');
		expect(GivenAttachment('attachments/a.zip').kind).toBe('other');
	});

	it('resolves through the resolver', async () => {
		const resolve = vi.fn(async () => ({ url: 'blob:x', contentType: 'image/png' }));
		const attachment = GivenAttachment('attachments/a.png', undefined, { resolve } as unknown as Resolver);

		expect(await attachment.resolve()).toEqual({ url: 'blob:x', contentType: 'image/png' });
		expect(resolve).toHaveBeenCalledWith(attachment.reference);
	});
});

function GivenAttachment(key: string, name?: string, resolver: Resolver = {} as Resolver): Attachment {
	return new Attachment(AttachmentReference.to('work', key), resolver, name);
}
