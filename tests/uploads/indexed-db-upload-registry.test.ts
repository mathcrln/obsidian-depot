import { expect, it } from 'vitest';
import { IndexedDbUploadRegistry } from '@/uploads/indexed-db-upload-registry';

it('rejects with an Error when opening fails without a native error', async () => {
	const request = { error: null } as IDBOpenDBRequest;
	const factory = { open: () => request } as unknown as IDBFactory;
	const opening = IndexedDbUploadRegistry.open('unavailable-registry', factory);

	request.onerror?.call(request, new Event('error'));

	await expect(opening).rejects.toEqual(new Error('IndexedDB request failed'));
});

it('preserves the native error when opening fails', async () => {
	const error = new DOMException('Storage is unavailable', 'SecurityError');
	const request = { error } as IDBOpenDBRequest;
	const factory = { open: () => request } as unknown as IDBFactory;
	const opening = IndexedDbUploadRegistry.open('unavailable-registry', factory);

	request.onerror?.call(request, new Event('error'));

	await expect(opening).rejects.toBe(error);
});
