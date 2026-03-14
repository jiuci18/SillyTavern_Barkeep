import type { ApiRouteContext, ApiRouteResult } from '../types/api';
import { createBadRequestResponse, createUnauthorizedResponse } from '../utils/api-response';
import { createAccessToken, getAccessTokenTtlSeconds, isPasswordAuthEnabled, validateApiPassword } from '../middleware/jwt';

interface LoginBody {
    password?: unknown;
}

function extractPassword(body: unknown): string | null {
    if (!body || typeof body !== 'object') {
        return null;
    }

    const password = (body as LoginBody).password;
    return typeof password === 'string' ? password : null;
}

export async function handleLogin({ body }: ApiRouteContext): Promise<ApiRouteResult> {
    if (!isPasswordAuthEnabled()) {
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

    const password = extractPassword(body);
    if (password === null) {
        return createBadRequestResponse('Request body must include a string password.');
    }

    if (!validateApiPassword(password)) {
        return createUnauthorizedResponse('Invalid password.');
    }

    console.log('[Sillytavern_Barkeeper] Login succeeded, issuing access token.');

    return {
        statusCode: 200,
        body: {
            enabled: true,
            token: createAccessToken(),
            tokenType: 'Bearer',
            expiresIn: getAccessTokenTtlSeconds(),
        },
    };
}
