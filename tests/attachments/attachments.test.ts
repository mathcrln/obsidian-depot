import { describe, expect, it } from 'vitest';
import { Attachments } from '@/attachments/attachments';
import type { Resolver } from '@/attachments/resolver';
import { AttachmentReference } from '@/references/attachment-reference';

describe('Attachments', () => {
	it('returns an attachment for a recognized reference', () => {
		const attachment = GivenAttachments(['work']).from('work://attachments/a.png');

		expect(attachment?.reference.toString()).toBe('work://attachments/a.png');
	});

	it('ignores references with an unrecognized scheme', () => {
		expect(GivenAttachments(['work']).from('zotero://select/items/1')).toBeUndefined();
	});

	it('ignores https links', () => {
		expect(GivenAttachments(['work']).from('https://example.com/a.png')).toBeUndefined();
	});

	it('ignores plain vault paths', () => {
		expect(GivenAttachments(['work']).from('attachments/a.png')).toBeUndefined();
	});

	it('returns an attachment for a recognized profile even when it is deleted', async () => {
		const resolver = { resolve: async () => Promise.reject(new Error('deleted')) } as unknown as Resolver;
		const attachment = GivenAttachments(['old'], resolver).from('old://a.png');

		expect(attachment).toBeDefined();
		await expect(attachment!.resolve()).rejects.toThrow('deleted');
	});

	it('builds an attachment from a reference with a name', () => {
		const attachment = GivenAttachments(['work']).of(AttachmentReference.to('work', 'a.zip'), 'Report');

		expect(attachment.markdown()).toBe('[Report](work://a.zip)');
	});

	describe('within', () => {
		it('finds a bare reference', () => {
			expect(WhenFindingWithin('work://covers/a.png')).toEqual(['work://covers/a.png']);
		});

		it('finds a reference written as an embed', () => {
			expect(WhenFindingWithin('![](work://covers/a.png)')).toEqual(['work://covers/a.png']);
		});

		it('finds a reference written as a link', () => {
			expect(WhenFindingWithin('[Cover](work://covers/a.png)')).toEqual(['work://covers/a.png']);
		});

		it('finds a reference in angle brackets', () => {
			expect(WhenFindingWithin('![](<work://covers/a.png>)')).toEqual(['work://covers/a.png']);
		});

		it('finds references in a list', () => {
			expect(WhenFindingWithin(['work://a.png', 'plain text', '![](work://b.png)'])).toEqual([
				'work://a.png',
				'work://b.png',
			]);
		});

		it('ignores unrecognized schemes, vault links, and other values', () => {
			expect(WhenFindingWithin('https://example.com/a.png')).toEqual([]);
			expect(WhenFindingWithin('[[cover.png]]')).toEqual([]);
			expect(WhenFindingWithin(42)).toEqual([]);
			expect(WhenFindingWithin(null)).toEqual([]);
		});
	});
});

function GivenAttachments(profiles: string[], resolver: Resolver = {} as Resolver): Attachments {
	return new Attachments({ resolver, recognizes: (id) => profiles.includes(id) });
}

function WhenFindingWithin(value: unknown): string[] {
	return GivenAttachments(['work'])
		.within(value)
		.map((attachment) => attachment.reference.toString());
}
