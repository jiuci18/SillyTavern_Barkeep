import { Chalk } from 'chalk';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

export type ApiMethod = 'GET' | 'POST' | 'OPTIONS';

export interface ApiRouteResult {
    statusCode: number;
    body?: unknown;
    headers?: Record<string, string>;
}

interface ApiRouteContext {
    body: unknown;
}

export interface ApiRouteDefinition {
    method: ApiMethod;
    path: string;
    requiresJsonBody?: boolean;
    handler: (ctx: ApiRouteContext) => Promise<ApiRouteResult> | ApiRouteResult;
}

const DEFAULT_CORS_HEADERS: Readonly<Record<string, string>> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Test-Header',
};

function withDefaultHeaders(headers?: Record<string, string>): Record<string, string> {
    return {
        ...DEFAULT_CORS_HEADERS,
        ...(headers ?? {}),
    };
}

function routeKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
}

function extractMessage(body: unknown): string {
    if (!body || typeof body !== 'object') {
        return '';
    }

    const message = (body as Record<string, unknown>).message;
    return typeof message === 'string' ? message : '';
}

export const API_ROUTES: readonly ApiRouteDefinition[] = [
    {
        method: 'OPTIONS',
        path: '/cors-test',
        handler: () => ({ statusCode: 204 }),
    },
    {
        method: 'GET',
        path: '/cors-test',
        handler: () => ({
            statusCode: 200,
            body: { ok: true, ts: Date.now() },
        }),
    },
    {
        method: 'POST',
        path: '/probe',
        handler: () => ({ statusCode: 204 }),
    },
    {
        method: 'POST',
        path: '/ping',
        requiresJsonBody: true,
        handler: ({ body }) => ({
            statusCode: 200,
            body: { message: `Pong! ${extractMessage(body)}` },
        }),
    },
];

const API_ROUTE_MAP: ReadonlyMap<string, ApiRouteDefinition> = new Map(
    API_ROUTES.map((route) => [routeKey(route.method, route.path), route])
);

export function getApiRoute(method: string, path: string): ApiRouteDefinition | null {
    return API_ROUTE_MAP.get(routeKey(method, path)) ?? null;
}

export async function executeApiRoute(route: ApiRouteDefinition, body: unknown): Promise<ApiRouteResult> {
    try {
        const result = await route.handler({ body });
        return {
            ...result,
            headers: withDefaultHeaders(result.headers),
        };
    } catch (error) {
        return internalErrorResponse(error);
    }
}

export async function dispatchApiRequest(method: string, path: string, body?: unknown): Promise<ApiRouteResult> {
    const route = getApiRoute(method, path);

    if (!route) {
        return notFoundResponse();
    }

    return executeApiRoute(route, body);
}

export function notFoundResponse(): ApiRouteResult {
    return {
        statusCode: 404,
        body: { error: 'Not Found' },
        headers: withDefaultHeaders(),
    };
}

export function internalErrorResponse(error?: unknown): ApiRouteResult {
    console.error(chalk.red(MODULE_NAME), 'Request failed', error);
    return {
        statusCode: 500,
        body: { error: 'Internal Server Error' },
        headers: withDefaultHeaders(),
    };
}
