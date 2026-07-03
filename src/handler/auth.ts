import type { ApiRouteContext, ApiRouteResult } from '../types/api';
import { authenticateLogin } from '../service/auth/login';
import { createBadRequestResponse, createUnauthorizedResponse } from '../utils/api-response';
import { createAccessToken, getAccessTokenTtlSeconds } from '../middleware/jwt';

export async function handleLogin({ body, clientAddress }: ApiRouteContext): Promise<ApiRouteResult> {
    const authentication = await authenticateLogin(body, clientAddress);
    if (authentication.kind === 'disabled') {
        return {
            statusCode: 200,
            body: {
                enabled: false,
                token: null,
                tokenType: null,
                expiresIn: 0,
            },
        };
    }
    if (authentication.kind === 'invalid-request') {
        return createBadRequestResponse(authentication.message);
    }
    if (authentication.kind === 'invalid-credentials') {
        return createUnauthorizedResponse('Incorrect credentials.');
    }
    if (authentication.kind === 'rate-limited') {
        return {
            statusCode: 429,
            headers: { 'Retry-After': String(authentication.retryAfter) },
            body: { error: 'Too many attempts. Try again later.' },
        };
    }

    console.log('[Sillytavern_Barkeeper] Login succeeded, issuing access token.');

    const user = authentication.accessScope.kind === 'user'
        ? authentication.accessScope.handle
        : undefined;
    return {
        statusCode: 200,
        body: {
            enabled: true,
            token: createAccessToken(authentication.accessScope),
            tokenType: 'Bearer',
            expiresIn: getAccessTokenTtlSeconds(),
            ...(user ? { user } : {}),
        },
    };
}
