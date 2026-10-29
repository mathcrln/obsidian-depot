import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AwsV4Signer } from 'aws4fetch';
import type { ProfileSettings } from '@/settings/settings';
import { AccessDenied, MissingCredentials, ObjectNotFound, StorageUnreachable } from '@/storages/object-store';
import { S3ObjectStore } from '@/storages/s3-object-store';
import { FakeHttp } from '../support/fake-http';
import { FakeSecrets } from '../support/fake-secrets';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-03-04T05:06:07.000Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('addressing', () => {
	it('uses path-style urls with a custom endpoint', async () => {
		const { store, http } = GivenStore({ endpoint: 'https://minio.local:9000', forcePathStyle: true });

		await store.get('notes/a b.png');

		expect(http.requests[0]?.method).toBe('GET');
		expect(http.requests[0]?.url).toBe('https://minio.local:9000/vault/notes/a%20b.png');
	});

	it('uses virtual-hosted urls with a custom endpoint', async () => {
		const { store, http } = GivenStore({ endpoint: 'https://r2.example.com', forcePathStyle: false });

		await store.get('notes/a.png');

		expect(http.requests[0]?.url).toBe('https://vault.r2.example.com/notes/a.png');
	});

	it('strips a trailing slash from the endpoint', async () => {
		const { store, http } = GivenStore({ endpoint: 'https://minio.local/', forcePathStyle: true });

		await store.get('a.png');

		expect(http.requests[0]?.url).toBe('https://minio.local/vault/a.png');
	});

	it('defaults to the AWS regional endpoint', async () => {
		const { store, http } = GivenStore({ endpoint: '', region: 'eu-west-3', forcePathStyle: true });

		await store.get('a.png');

		expect(http.requests[0]?.url).toBe('https://s3.eu-west-3.amazonaws.com/vault/a.png');
	});

	it('falls back to us-east-1 for region auto without endpoint', async () => {
		const { store, http } = GivenStore({ endpoint: '', region: 'auto', forcePathStyle: false });

		await store.get('a.png');

		expect(http.requests[0]?.url).toBe('https://vault.s3.us-east-1.amazonaws.com/a.png');
		expect(http.requests[0]?.headers['authorization']).toContain('/20260304/us-east-1/s3/aws4_request');
	});

	it('percent-encodes reserved characters in each segment and keeps slashes', async () => {
		const { store, http } = GivenStore({ endpoint: 'https://s3.test', forcePathStyle: true });

		await store.get("dir/é+(x)!'*#?.png");

		expect(http.requests[0]?.url).toBe('https://s3.test/vault/dir/%C3%A9%2B%28x%29%21%27%2A%23%3F.png');
	});
});

describe('put', () => {
	it('sends a PUT with the body and content type', async () => {
		const { store, http } = GivenStore();
		const bytes = new Uint8Array([1, 2, 3]).buffer;

		await store.put('a.png', bytes, 'image/png');

		expect(http.requests[0]?.method).toBe('PUT');
		expect(http.requests[0]?.headers['content-type']).toBe('image/png');
		expect(new Uint8Array(http.requests[0]?.body ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('signs the payload hash', async () => {
		const { store, http } = GivenStore();

		await store.put('a.png', new TextEncoder().encode('hello').buffer, 'text/plain');

		expect(http.requests[0]?.headers['x-amz-content-sha256']).toBe(
			'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
		);
	});

	it('rejects with the status when the server fails', async () => {
		const { store, http } = GivenStore();
		http.respondWith({ status: 500 });

		await expect(store.put('a.png', new ArrayBuffer(0), 'image/png')).rejects.toThrow(/500/);
	});
});

describe('signing', () => {
	it('sends a SigV4 authorization scoped to date, region and service', async () => {
		const { store, http } = GivenStore({ region: 'eu-west-3' });

		await store.get('a.png');

		const headers = http.requests[0]?.headers ?? {};
		expect(headers['authorization']).toMatch(
			/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20260304\/eu-west-3\/s3\/aws4_request, /
		);
		expect(headers['authorization']).toMatch(/SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/);
		expect(headers['x-amz-date']).toBe('20260304T050607Z');
	});

	it('reproduces the documented AWS example signature', async () => {
		const signer = new AwsV4Signer({
			method: 'GET',
			url: 'https://examplebucket.s3.amazonaws.com/test.txt',
			headers: {
				Range: 'bytes=0-9',
				'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
			},
			accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
			secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
			service: 's3',
			region: 'us-east-1',
			datetime: '20130524T000000Z',
			allHeaders: true,
		});

		const signed = await signer.sign();

		expect(signed.headers.get('Authorization')).toBe(
			'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
				'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
				'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'
		);
	});

	it('pins the full signature of a store request at a fixed time', async () => {
		vi.setSystemTime(new Date('2013-05-24T00:00:00.000Z'));
		const { store, http } = GivenStore({
			endpoint: 'https://s3.amazonaws.com',
			forcePathStyle: false,
			bucket: 'examplebucket',
			secrets: { access: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
		});

		await store.get('test.txt');

		expect(http.requests[0]?.url).toBe('https://examplebucket.s3.amazonaws.com/test.txt');
		expect(http.requests[0]?.headers['authorization']).toBe(
			'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
				'SignedHeaders=host;x-amz-content-sha256;x-amz-date, ' +
				'Signature=df548e2ce037944d03f3e68682813b093763996d597cf890ca3d9037fd231eb4'
		);
	});
});

describe('get', () => {
	it('returns bytes, content type and unquoted etag', async () => {
		const { store, http } = GivenStore();
		http.respondWith({
			status: 200,
			headers: { 'Content-Type': 'image/png', ETag: '"abc123"' },
			body: new Uint8Array([9, 8]).buffer,
		});

		const object = await store.get('a.png');

		expect(new Uint8Array(object.bytes)).toEqual(new Uint8Array([9, 8]));
		expect(object.contentType).toBe('image/png');
		expect(object.etag).toBe('abc123');
	});

	it('falls back to octet-stream without a content type', async () => {
		const { store, http } = GivenStore();
		http.respondWith({ status: 200, headers: {} });

		const object = await store.get('a.bin');

		expect(object.contentType).toBe('application/octet-stream');
		expect(object.etag).toBeUndefined();
	});
});

describe('head', () => {
	it('returns content type, size and etag from a HEAD request', async () => {
		const { store, http } = GivenStore();
		http.respondWith({ status: 200, headers: { 'content-type': 'image/jpeg', 'Content-Length': '42', etag: '"e1"' } });

		const metadata = await store.head('a.jpg');

		expect(http.requests[0]?.method).toBe('HEAD');
		expect(metadata).toEqual({ contentType: 'image/jpeg', size: 42, etag: 'e1' });
	});
});

describe('failures', () => {
	it('maps 404 to ObjectNotFound', async () => {
		const { store, http } = GivenStore();
		http.respondWith({ status: 404 });

		await expect(store.get('missing.png')).rejects.toBeInstanceOf(ObjectNotFound);
		await expect(store.head('missing.png')).rejects.toBeInstanceOf(ObjectNotFound);
	});

	it.each([401, 403])('maps %i to AccessDenied', async (status) => {
		const { store, http } = GivenStore();
		http.respondWith({ status });

		await expect(store.get('a.png')).rejects.toBeInstanceOf(AccessDenied);
		await expect(store.put('a.png', new ArrayBuffer(0), 'image/png')).rejects.toBeInstanceOf(AccessDenied);
	});

	it('maps other statuses to StorageUnreachable mentioning the status', async () => {
		const { store, http } = GivenStore();
		http.respondWith({ status: 503 });

		const failure = await store.get('a.png').catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(StorageUnreachable);
		expect((failure as Error).message).toContain('503');
	});

	it('maps a network failure to StorageUnreachable with the reason', async () => {
		const { store, http } = GivenStore();
		http.failWith('ECONNREFUSED');

		const failure = await store.get('a.png').catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(StorageUnreachable);
		expect((failure as Error).message).toContain('ECONNREFUSED');
	});
});

describe('credentials', () => {
	it.each([
		['access key', { secret: 'sk' }],
		['secret key', { access: 'ak' }],
		['both keys', {}],
		['empty keys', { access: '', secret: '' }],
	])('throws MissingCredentials without sending a request when the %s is missing', async (_label, secrets) => {
		const { store, http } = GivenStore({ secrets });

		await expect(store.get('a.png')).rejects.toEqual(new MissingCredentials('main'));
		await expect(store.put('a.png', new ArrayBuffer(0), 'image/png')).rejects.toBeInstanceOf(MissingCredentials);
		await expect(store.head('a.png')).rejects.toBeInstanceOf(MissingCredentials);

		expect(http.requests).toHaveLength(0);
	});

	it('reads secrets at request time', async () => {
		const values: Record<string, string> = {};
		const http = new FakeHttp();
		const store = S3ObjectStore.for(GivenProfile(), { http, secrets: new FakeSecrets(values) });

		await expect(store.get('a.png')).rejects.toBeInstanceOf(MissingCredentials);
		values['access'] = 'ak';
		values['secret'] = 'sk';
		await store.get('a.png');

		expect(http.requests).toHaveLength(1);
	});
});

interface StoreOptions extends Partial<ProfileSettings> {
	secrets?: Record<string, string>;
}

function GivenStore(options: StoreOptions = {}) {
	const { secrets = { access: 'AKIDEXAMPLE', secret: 'sk' }, ...profile } = options;
	const http = new FakeHttp();
	const store = S3ObjectStore.for(GivenProfile(profile), { http, secrets: new FakeSecrets(secrets) });
	return { store, http };
}

function GivenProfile(overrides: Partial<ProfileSettings> = {}): ProfileSettings {
	return {
		id: 'main',
		endpoint: 'https://s3.test',
		bucket: 'vault',
		region: 'us-east-1',
		forcePathStyle: true,
		accessKeySecret: 'access',
		secretKeySecret: 'secret',
		...overrides,
	};
}
