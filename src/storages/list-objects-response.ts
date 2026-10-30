import type { ObjectSummary } from './object-store';

export interface ListObjectsPage {
	objects: ObjectSummary[];
	nextToken: string | undefined;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function parseListObjectsResponse(xml: string): ListObjectsPage {
	const objects: ObjectSummary[] = [];

	for (const block of blocksOf(xml, 'Contents')) {
		const key = textOf(block, 'Key');
		if (key === undefined) continue;

		const etag = textOf(block, 'ETag')?.replace(/^"|"$/g, '');
		const summary: ObjectSummary = {
			key,
			size: Number(textOf(block, 'Size') ?? 0),
			lastModified: Date.parse(textOf(block, 'LastModified') ?? ''),
		};
		if (etag !== undefined) summary.etag = etag;
		objects.push(summary);
	}

	const rest = xml.replace(/<Contents>[\s\S]*?<\/Contents>/g, '');
	const truncated = textOf(rest, 'IsTruncated') === 'true';

	return { objects, nextToken: truncated ? textOf(rest, 'NextContinuationToken') : undefined };
}

function blocksOf(xml: string, tag: string): string[] {
	return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((match) => match[1] ?? '');
}

function textOf(xml: string, tag: string): string | undefined {
	const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);

	return match?.[1] === undefined ? undefined : decode(match[1]);
}

function decode(text: string): string {
	return text.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-z]+));/g, (whole, hex?: string, decimal?: string, name?: string) => {
		if (name !== undefined) return ENTITIES[name] ?? whole;

		const code = hex !== undefined ? parseInt(hex, 16) : Number(decimal);

		return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
	});
}
