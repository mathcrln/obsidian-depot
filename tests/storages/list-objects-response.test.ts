import { describe, expect, it } from 'vitest';
import { parseListObjectsResponse } from '@/storages/list-objects-response';

describe('parseListObjectsResponse', () => {
	it('reads key, size, last modified and etag of each entry', () => {
		const page = parseListObjectsResponse(
			GivenResult(
				GivenContents({ key: 'a/b.png', size: 12, lastModified: '2026-03-04T05:06:07.000Z', etag: '"abc"' }),
				GivenContents({ key: 'c.pdf', size: 0, lastModified: '2026-03-04T05:06:08.500Z', etag: '"def"' })
			)
		);

		expect(page.objects).toEqual([
			{ key: 'a/b.png', size: 12, lastModified: Date.parse('2026-03-04T05:06:07.000Z'), etag: 'abc' },
			{ key: 'c.pdf', size: 0, lastModified: Date.parse('2026-03-04T05:06:08.500Z'), etag: 'def' },
		]);
	});

	it('strips etag quotes written as entities', () => {
		const page = parseListObjectsResponse(GivenResult(GivenContents({ key: 'a', etag: '&quot;abc&quot;' })));

		expect(page.objects[0]?.etag).toBe('abc');
	});

	it('decodes named and numeric entities in keys', () => {
		const page = parseListObjectsResponse(
			GivenResult(GivenContents({ key: 'a&amp;b &lt;c&gt; &quot;d&quot; &apos;e&apos; &#233;&#x1F600;.png' }))
		);

		expect(page.objects[0]?.key).toBe('a&b <c> "d" \'e\' é😀.png');
	});

	it('does not decode entities twice', () => {
		const page = parseListObjectsResponse(GivenResult(GivenContents({ key: 'a&amp;lt;b' })));

		expect(page.objects[0]?.key).toBe('a&lt;b');
	});

	it('omits the etag when absent', () => {
		const page = parseListObjectsResponse(
			'<ListBucketResult><Contents><Key>a</Key><LastModified>2026-03-04T05:06:07.000Z</LastModified><Size>1</Size></Contents></ListBucketResult>'
		);

		expect(page.objects[0]).toEqual({ key: 'a', size: 1, lastModified: Date.parse('2026-03-04T05:06:07.000Z') });
	});

	it('reports a truncated page with its continuation token', () => {
		const page = parseListObjectsResponse(
			GivenResult(
				GivenContents({ key: 'a' }),
				'<IsTruncated>true</IsTruncated><NextContinuationToken>t+o/k=</NextContinuationToken>'
			)
		);

		expect(page.nextToken).toBe('t+o/k=');
	});

	it('reports no continuation token when not truncated', () => {
		const page = parseListObjectsResponse(
			GivenResult(
				GivenContents({ key: 'a' }),
				'<IsTruncated>false</IsTruncated><NextContinuationToken>ignored</NextContinuationToken>'
			)
		);

		expect(page.nextToken).toBeUndefined();
	});

	it('returns no objects for an empty listing', () => {
		const page = parseListObjectsResponse(
			'<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
		);

		expect(page).toEqual({ objects: [], nextToken: undefined });
	});

	it('ignores common prefixes', () => {
		const page = parseListObjectsResponse(
			GivenResult(GivenContents({ key: 'a' }), '<CommonPrefixes><Prefix>dir/</Prefix></CommonPrefixes>')
		);

		expect(page.objects.map((object) => object.key)).toEqual(['a']);
	});
});

function GivenResult(contents: string, extra = '<IsTruncated>false</IsTruncated>'): string {
	return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>vault</Name>${contents}${extra}</ListBucketResult>`;
}

function GivenContents(options: { key: string; size?: number; lastModified?: string; etag?: string }): string {
	const { key, size = 1, lastModified = '2026-03-04T05:06:07.000Z', etag = '"x"' } = options;

	return `<Contents><Key>${key}</Key><LastModified>${lastModified}</LastModified><ETag>${etag}</ETag><Size>${size}</Size><StorageClass>STANDARD</StorageClass></Contents>`;
}
