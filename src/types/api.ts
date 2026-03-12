export type ApiMethod = 'GET' | 'POST' | 'OPTIONS';

export interface ApiRouteResult {
    statusCode: number;
    body?: unknown;
    headers?: Record<string, string>;
}

export interface ApiRouteContext {
    body: unknown;
    params: Record<string, string>;
    path: string;
}

export interface ApiRouteDefinition {
    method: ApiMethod;
    path: string;
    requiresJsonBody?: boolean;
    handler: (ctx: ApiRouteContext) => Promise<ApiRouteResult> | ApiRouteResult;
}

export interface ApiRouteMatch {
    route: ApiRouteDefinition;
    params: Record<string, string>;
}
