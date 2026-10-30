import type { UploadableFile, UploadContext, UploadResult } from '@/storages/profile';

export type UploadFile<A> = (file: UploadableFile, context: UploadContext) => Promise<UploadResult<A>>;

export type UploadEvent<A> =
	| { type: 'started'; file: UploadableFile }
	| ({ type: 'uploaded'; file: UploadableFile } & UploadResult<A>)
	| { type: 'failed'; file: UploadableFile; error: unknown };

interface UploadAttachmentsOptions<A> {
	files: readonly UploadableFile[];
	upload: UploadFile<A>;
	context?: UploadContext;
}

export async function* uploadAttachments<A>({
	files,
	upload,
	context = {},
}: UploadAttachmentsOptions<A>): AsyncGenerator<UploadEvent<A>> {
	for (const file of files) {
		yield { type: 'started', file };

		try {
			const result = await upload(file, context);
			yield { type: 'uploaded', file, ...result };
		} catch (error) {
			yield { type: 'failed', file, error };
		}
	}
}
