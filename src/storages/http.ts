export interface HttpRequest {
	method: 'GET' | 'PUT' | 'HEAD';
	url: string;
	headers: Record<string, string>;
	body?: ArrayBuffer;
}

export interface HttpResponse {
	status: number;
	headers: Record<string, string>;
	body: ArrayBuffer;
}

export interface Http {
	send(request: HttpRequest): Promise<HttpResponse>;
}
