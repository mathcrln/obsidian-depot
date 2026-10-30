import { describe, expect, it } from 'vitest';
import { rewriteReferences } from '@/references/rewrite-references';

describe('rewriteReferences', () => {
	it('rewrites a markdown embed', () => {
		expect(GivenRewrite('![alt](old://a/b.png)')).toEqual({ text: '![alt](new://a/b.png)', count: 1 });
	});

	it('rewrites a markdown link', () => {
		expect(GivenRewrite('[doc](old://file.pdf)').text).toBe('[doc](new://file.pdf)');
	});

	it('rewrites a reference in angle brackets', () => {
		expect(GivenRewrite('![](<old://my%20file.png>)').text).toBe('![](<new://my%20file.png>)');
	});

	it('rewrites frontmatter values, quoted or not', () => {
		const text = 'cover: old://a.png\nbanner: "old://b.png"\nother: \'old://c.png\'\n';

		expect(GivenRewrite(text)).toEqual({
			text: 'cover: new://a.png\nbanner: "new://b.png"\nother: \'new://c.png\'\n',
			count: 3,
		});
	});

	it('rewrites bare text', () => {
		expect(GivenRewrite('see old://x.png now').text).toBe('see new://x.png now');
	});

	it('rewrites canvas JSON strings', () => {
		const text = '{"nodes":[{"type":"file","file":"old://a.png"},{"text":"![](old://b.png)"}]}';

		expect(GivenRewrite(text)).toEqual({
			text: '{"nodes":[{"type":"file","file":"new://a.png"},{"text":"![](new://b.png)"}]}',
			count: 2,
		});
	});

	it('rewrites every occurrence, including several on one line', () => {
		expect(GivenRewrite('old://a old://b\nold://c')).toEqual({ text: 'new://a new://b\nnew://c', count: 3 });
	});

	it('changes only the profile part', () => {
		expect(GivenRewrite('old://2025/%28x%29-ID.png').text).toBe('new://2025/%28x%29-ID.png');
	});

	it.each(['xold://a.png', 'my-old://a.png', 'my.old://a.png', 'a1old://a.png', 'c++old://a.png', '1old://a.png'])(
		'leaves %s untouched',
		(text) => {
			expect(GivenRewrite(text)).toEqual({ text, count: 0 });
		}
	);

	it('leaves other profiles, keys and words untouched', () => {
		const text = 'other://a.png\nold: yes\nold:/x\nolder://a\nkey old\n';

		expect(GivenRewrite(text)).toEqual({ text, count: 0 });
	});

	it('does nothing for an empty text', () => {
		expect(GivenRewrite('')).toEqual({ text: '', count: 0 });
	});

	it('treats the old profile literally', () => {
		expect(rewriteReferences('a-b://x', 'a-b', 'c')).toEqual({ text: 'c://x', count: 1 });
	});
});

function GivenRewrite(text: string) {
	return rewriteReferences(text, 'old', 'new');
}
