import { handleLogin } from '../../handler/auth';
import { handleUserStatusList } from '../../handler/status';
import type { ApiMethod, ApiRouteDefinition, ApiRouteMatch, ApiRouteResult } from '../../types/api';
import { createInternalErrorResponse } from '../../utils/api-response';
import { matchRoutePath } from '../../utils/route';

function extractMessage(body: unknown): string {
    if (!body || typeof body !== 'object') {
        return '';
    }

    const message = (body as Record<string, unknown>).message;
    return typeof message === 'string' ? message : '';
}

export const API_ROUTES: readonly ApiRouteDefinition[] = [
    {
        method: 'POST',
        path: '/v1/login',
        requiresJsonBody: true,
        requiresAuth: false,
        handler: handleLogin,
    },
    {
        method: 'GET',
        path: '/v1/{user}/status/list',
        handler: handleUserStatusList,
    },
];

export function matchApiRoute(method: string, path: string): ApiRouteMatch | null {
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
        return await route.handler({ body, params, path });
    } catch (error) {
        const err = error as Error & { code?: string };
        if (err.code === 'USER_NOT_FOUND') {
            return {
                statusCode: 404,
                body: { error: err.message },
            };
        }

        if (err.message === 'Invalid user handle.') {
            return {
                statusCode: 400,
                body: { error: err.message },
            };
        }

        return createInternalErrorResponse(error);
    }
}
