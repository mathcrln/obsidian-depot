export interface Rewritten {
	text: string;
	count: number;
}

export function rewriteReferences(text: string, from: string, to: string): Rewritten {
	let count = 0;
	const pattern = new RegExp(`(?<![A-Za-z0-9+.-])${escapeRegExp(from)}://`, 'g');

	const rewritten = text.replace(pattern, () => {
		count++;
		return `${to}://`;
	});

	return { text: rewritten, count };
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
