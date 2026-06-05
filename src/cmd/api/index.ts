import { handleLogin } from '../../handler/auth';
import { handleResourceDelete, handleResourceGet, handleResourcePost } from '../../handler/resource';
import { handleSourceInfo, handleSourceRegister } from '../../handler/src';
import { handleUserStatusList } from '../../handler/status';
import type { ApiRouteDefinition, ApiRouteMatch, ApiRouteResult } from '../../types/api';
import { createApiErrorResponse } from '../../utils/errors';
import { matchRoutePath } from '../../utils/route';

export const API_ROUTES: readonly ApiRouteDefinition[] = [
    {
        method: 'POST',
        path: '/v1/login',
        bodyMode: 'json',
        requiresJsonBody: true,
        requiresAuth: false,
        handler: handleLogin,
    },
    {
        method: 'GET',
        path: '/v1/{user}/status/list',
        handler: handleUserStatusList,
    },
    {
        method: 'POST',
        path: '/v1/{user}/src',
        bodyMode: 'json',
        requiresJsonBody: true,
        handler: handleSourceInfo,
    },
    {
        method: 'PUT',
        path: '/v1/{user}/src',
        bodyMode: 'json',
        requiresJsonBody: true,
        handler: handleSourceRegister,
    },
    {
        method: 'GET',
        path: '/v1/{user}/{resource}/{uuid}',
        handler: handleResourceGet,
    },
    {
        method: 'POST',
        path: '/v1/{user}/{resource}/{uuid}',
        bodyMode: 'raw',
        handler: handleResourcePost,
    },
    {
        method: 'DELETE',
        path: '/v1/{user}/{resource}/{uuid}',
        handler: handleResourceDelete,
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
    path: string,
): Promise<ApiRouteResult> {
    try {
        return await route.handler({ body, params, path });
    } catch (error) {
        return createApiErrorResponse(error);
    }
}
