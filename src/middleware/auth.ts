import type { IncomingHttpHeaders } from 'http';
import type { ApiRouteDefinition, ApiRouteResult } from '../types/api';
import { createUnauthorizedResponse } from '../utils/api-response';
import { isPasswordAuthEnabled, readBearerToken, verifyAccessToken } from './jwt';

export function authorizeApiRequest(
    route: ApiRouteDefinition | null,
    authorizationHeader: IncomingHttpHeaders['authorization']
): ApiRouteResult | null {
    if (!route || route.requiresAuth === false || !isPasswordAuthEnabled()) {
        return null;
    }

    const token = readBearerToken(authorizationHeader);
    if (!token) {
        return createUnauthorizedResponse('Missing or invalid Bearer token.');
    }

    if (!verifyAccessToken(token)) {
        return createUnauthorizedResponse('Invalid or expired token.');
    }

    return null;
}
