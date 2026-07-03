import type { IncomingHttpHeaders } from 'http';
import { getConfig } from '../config/config';
import type { AccessScope, ApiRouteDefinition, ApiRouteResult } from '../types/api';
import { createForbiddenResponse, createUnauthorizedResponse } from '../utils/api-response';
import { isTokenAuthEnabled, readBearerToken, verifyAccessToken } from './jwt';

export interface AuthorizationResult {
    accessScope: AccessScope | null;
    rejection: ApiRouteResult | null;
}

export function authorizeApiRequest(
    route: ApiRouteDefinition | null,
    authorizationHeader: IncomingHttpHeaders['authorization'],
    transportScope?: AccessScope,
): AuthorizationResult {
    if (!route || route.requiresAuth === false) {
        return { accessScope: transportScope ?? null, rejection: null };
    }

    const config = getConfig();
    const forceToken = config.env.API_PASSWORD_FORCE;

    if (!forceToken) {
        if (transportScope) {
            return { accessScope: transportScope, rejection: null };
        }

        if (!config.env.HTTP_MODE) {
            return {
                accessScope: null,
                rejection: createUnauthorizedResponse('Authenticated SillyTavern session required.'),
            };
        }
    }

    if (!isTokenAuthEnabled()) {
        return { accessScope: { kind: 'server' }, rejection: null };
    }

    const token = readBearerToken(authorizationHeader);
    if (!token) {
        return {
            accessScope: null,
            rejection: createUnauthorizedResponse('Missing or invalid Bearer token.'),
        };
    }

    const accessScope = verifyAccessToken(token);
    if (!accessScope) {
        return {
            accessScope: null,
            rejection: createUnauthorizedResponse('Invalid or expired token.'),
        };
    }

    if (forceToken && transportScope && transportScope.kind === 'user' && accessScope.kind === 'user' && transportScope.handle !== accessScope.handle) {
        return {
            accessScope: null,
            rejection: createForbiddenResponse('Token user does not match ST session.'),
        };
    }

    return { accessScope, rejection: null };
}

/** Reject a user-scoped credential that targets another user's route. */
export function authorizeRouteUser(
    params: Record<string, string>,
    accessScope: AccessScope | null,
): ApiRouteResult | null {
    if (!params.user || !accessScope || accessScope.kind === 'server') {
        return null;
    }
    if (params.user !== accessScope.handle) {
        return createForbiddenResponse('Authenticated user cannot access another user.');
    }

    return null;
}
