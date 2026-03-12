import { Chalk } from 'chalk';
import { handleUserStatusList } from '../../handler/status';
import type { ApiMethod, ApiRouteDefinition, ApiRouteMatch, ApiRouteResult } from '../../types/api';
import { matchRoutePath } from '../../utils/route';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

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
    {
        method: 'GET',
        path: '/v1/{user}/status/list',
        handler: handleUserStatusList,
    },
];

const API_ROUTE_MAP: ReadonlyMap<string, ApiRouteDefinition> = new Map(
    API_ROUTES.map((route) => [routeKey(route.method, route.path), route])
);

export function getApiRoute(method: string, path: string): ApiRouteDefinition | null {
    return API_ROUTE_MAP.get(routeKey(method, path)) ?? null;
}

export function matchApiRoute(method: string, path: string): ApiRouteMatch | null {
    const exactRoute = getApiRoute(method, path);
    if (exactRoute) {
        return {
            route: exactRoute,
            params: {},
        };
    }

    const normalizedMethod = method.toUpperCase();
    for (const route of API_ROUTES) {
        if (route.method !== normalizedMethod) {
            continue;
        }

        const params = matchRoutePath(route.path, path);
        if (params) {
            return {
                route,
                params,
            };
        }
    }

    return null;
}

export async function executeApiRoute(
    route: ApiRouteDefinition,
    body: unknown,
    params: Record<string, string>,
    path: string
): Promise<ApiRouteResult> {
    try {
        const result = await route.handler({ body, params, path });
        return {
            ...result,
            headers: withDefaultHeaders(result.headers),
        };
    } catch (error) {
        const err = error as Error & { code?: string };
        if (err.code === 'USER_NOT_FOUND') {
            return {
                statusCode: 404,
                body: { error: err.message },
                headers: withDefaultHeaders(),
            };
        }

        if (err.message === 'Invalid user handle.') {
            return {
                statusCode: 400,
                body: { error: err.message },
                headers: withDefaultHeaders(),
            };
        }

        return internalErrorResponse(error);
    }
}

export async function dispatchApiRequest(method: string, path: string, body?: unknown): Promise<ApiRouteResult> {
    const match = matchApiRoute(method, path);

    if (!match) {
        return notFoundResponse();
    }

    return executeApiRoute(match.route, body, match.params, path);
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
