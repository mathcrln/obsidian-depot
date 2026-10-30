export type Provider = 'aws' | 'r2' | 'other';

export function providerOf(endpoint: string): Provider {
	if (endpoint.trim() === '') return 'aws';

	let host: string;
	try {
		host = new URL(endpoint.trim()).hostname;
	} catch {
		return 'other';
	}

	if (host.endsWith('.amazonaws.com')) return 'aws';
	if (host.endsWith('.r2.cloudflarestorage.com')) return 'r2';

	return 'other';
}
