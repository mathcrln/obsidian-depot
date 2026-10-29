import { requestUrl } from 'obsidian';
import type { Http, HttpRequest, HttpResponse } from '@/storages/http';

export const obsidianHttp: Http = {
	async send(request: HttpRequest): Promise<HttpResponse> {
		const response = await requestUrl({
			url: request.url,
			method: request.method,
			headers: request.headers,
			body: request.body,
			throw: false,
		});

		return {
			status: response.status,
			headers: response.headers,
			body: request.method === 'HEAD' ? new ArrayBuffer(0) : response.arrayBuffer,
		};
	},
};
