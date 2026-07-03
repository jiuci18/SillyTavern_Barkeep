export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
export type ApiBodyMode = 'json' | 'raw';

/** Identity scope established by the active HTTP transport. */
export type AccessScope =
    | { kind: 'user'; handle: string }
    | { kind: 'server' };

export interface ApiRouteResult {
    statusCode: number;
    body?: unknown;
    headers?: Record<string, string>;
}

export interface ApiRouteContext {
    body: unknown;
    params: Record<string, string>;
    path: string;
    clientAddress?: string;
}

export interface ApiRouteDefinition {
    method: ApiMethod;
    path: string;
    bodyMode?: ApiBodyMode;
    requiresJsonBody?: boolean;
    requiresAuth?: boolean;
    handler: (ctx: ApiRouteContext) => Promise<ApiRouteResult> | ApiRouteResult;
}

export interface ApiRouteMatch {
    route: ApiRouteDefinition;
    params: Record<string, string>;
}
