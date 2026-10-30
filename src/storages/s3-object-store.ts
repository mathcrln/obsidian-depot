import { AwsV4Signer } from 'aws4fetch';
import type { ProfileSettings } from '@/settings/settings';
import type { Secrets } from '@/settings/secrets';
import { parseListObjectsResponse } from './list-objects-response';
import type { Http, HttpRequest, HttpResponse } from './http';
import {
	AccessDenied,
	MissingCredentials,
	ObjectNotFound,
	StorageUnreachable,
	type ObjectMetadata,
	type ObjectStore,
	type ObjectSummary,
	type StoredObject,
} from './object-store';

export interface S3Dependencies {
	http: Http;
	secrets: Secrets;
}

interface Credentials {
	accessKeyId: string;
	secretAccessKey: string;
}

export class S3ObjectStore implements ObjectStore {
	private readonly profile: ProfileSettings;
	private readonly http: Http;
	private readonly secrets: Secrets;

	constructor(options: S3Dependencies & { profile: ProfileSettings }) {
		this.profile = options.profile;
		this.http = options.http;
		this.secrets = options.secrets;
	}

	static for(profile: ProfileSettings, dependencies: S3Dependencies): S3ObjectStore {
		return new S3ObjectStore({ profile, ...dependencies });
	}

	async put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
		await this.request(key, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
	}

	async get(key: string): Promise<StoredObject> {
		const response = await this.request(key, { method: 'GET' });
		return {
			bytes: response.body,
			contentType: header(response, 'content-type') ?? 'application/octet-stream',
			etag: etagOf(response),
		};
	}

	async head(key: string): Promise<ObjectMetadata> {
		const response = await this.request(key, { method: 'HEAD' });
		return {
			contentType: header(response, 'content-type') ?? 'application/octet-stream',
			size: Number(header(response, 'content-length') ?? 0),
			etag: etagOf(response),
		};
	}

	async *list(prefix?: string): AsyncGenerator<ObjectSummary> {
		let token: string | undefined;

		do {
			const response = await this.request('', { method: 'GET', query: listQuery(prefix, token) });
			const page = parseListObjectsResponse(new TextDecoder().decode(response.body));
			yield* page.objects;
			token = page.nextToken;
		} while (token !== undefined);
	}

	private async request(key: string, options: RequestOptions): Promise<HttpResponse> {
		const credentials = this.credentials();
		const request = await this.sign(key, credentials, options);

		let response: HttpResponse;
		try {
			response = await this.http.send(request);
		} catch (error) {
			throw new StorageUnreachable(error instanceof Error ? error.message : String(error));
		}

		if (response.status >= 200 && response.status < 300) return response;

		const code = errorCodeOf(response);
		const suffix = code ? ` (${code})` : '';

		if (response.status === 404 && (key === '' || code === 'NoSuchBucket')) {
			throw new StorageUnreachable(`bucket or endpoint not found${suffix}`);
		}
		if (response.status === 404) throw new ObjectNotFound(`${key}${suffix}`);
		if (response.status === 401 || response.status === 403) throw new AccessDenied(`${key}${suffix}`);
		throw new StorageUnreachable(`HTTP ${response.status}${suffix}`);
	}

	private credentials(): Credentials {
		const accessKeyId = this.secrets.get(this.profile.accessKeySecret);
		const secretAccessKey = this.secrets.get(this.profile.secretKeySecret);
		if (!accessKeyId || !secretAccessKey) throw new MissingCredentials(this.profile.id);
		return { accessKeyId, secretAccessKey };
	}

	private async sign(key: string, credentials: Credentials, options: RequestOptions): Promise<HttpRequest> {
		const payload = options.body ?? new ArrayBuffer(0);
		const signer = new AwsV4Signer({
			method: options.method,
			url: this.urlFor(key, options.query),
			headers: { ...options.headers, 'x-amz-content-sha256': await sha256Hex(payload) },
			body: options.body,
			service: 's3',
			region: this.signingRegion(),
			...credentials,
		});
		const signed = await signer.sign();

		const headers: Record<string, string> = {};
		signed.headers.forEach((value, name) => {
			headers[name] = value;
		});
		return { method: options.method, url: signed.url.toString(), headers, body: options.body };
	}

	private signingRegion(): string {
		const { region, endpoint } = this.profile;
		if (!region) return 'us-east-1';
		return region === 'auto' && !endpoint.trim() ? 'us-east-1' : region;
	}

	private urlFor(key: string, query = ''): string {
		const path = key.split('/').map(encodeSegment).join('/');
		const endpoint = new URL(this.endpoint());
		const search = query === '' ? '' : `?${query}`;
		if (this.profile.forcePathStyle) {
			return `${endpoint.origin}${endpoint.pathname.replace(/\/$/, '')}/${this.profile.bucket}/${path}${search}`;
		}
		return `${endpoint.protocol}//${this.profile.bucket}.${endpoint.host}${endpoint.pathname.replace(/\/$/, '')}/${path}${search}`;
	}

	private endpoint(): string {
		const configured = this.profile.endpoint.trim().replace(/\/+$/, '');
		if (configured) return configured;
		const region = !this.profile.region || this.profile.region === 'auto' ? 'us-east-1' : this.profile.region;
		return `https://s3.${region}.amazonaws.com`;
	}
}

interface RequestOptions {
	method: HttpRequest['method'];
	headers?: Record<string, string>;
	body?: ArrayBuffer;
	query?: string;
}

function listQuery(prefix: string | undefined, token: string | undefined): string {
	const params = ['list-type=2'];
	if (prefix) params.push(`prefix=${encodeSegment(prefix)}`);
	if (token) params.push(`continuation-token=${encodeSegment(token)}`);
	return params.join('&');
}

function encodeSegment(segment: string): string {
	return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function errorCodeOf(response: HttpResponse): string | undefined {
	return /<Code>([^<]+)<\/Code>/.exec(new TextDecoder().decode(response.body))?.[1];
}

function header(response: HttpResponse, name: string): string | undefined {
	const wanted = name.toLowerCase();
	for (const [candidate, value] of Object.entries(response.headers)) {
		if (candidate.toLowerCase() === wanted) return value;
	}
	return undefined;
}

function etagOf(response: HttpResponse): string | undefined {
	return header(response, 'etag')?.replace(/^"|"$/g, '');
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
