import { expect, it } from 'vitest';
import { providerOf } from '@/storages/provider';

it.each([
	['', 'aws'],
	['https://s3.eu-west-3.amazonaws.com', 'aws'],
	['https://s3.amazonaws.com/', 'aws'],
	['https://0123abcd.r2.cloudflarestorage.com', 'r2'],
	['https://0123abcd.eu.r2.cloudflarestorage.com', 'r2'],
	['http://localhost:9000', 'other'],
	['https://s3.us-west-002.backblazeb2.com', 'other'],
	['not a url', 'other'],
])('recognises %j as %s', (endpoint, provider) => {
	expect(providerOf(endpoint)).toBe(provider);
});
