//! Authentication policy for Barkeep login requests.

import { getConfig } from '../../config/config';
import type { AccessScope } from '../../types/api';
import { isApiPasswordEnabled, verifyApiPassword } from './api-password';
import { clearLoginAttempts, consumeLoginAttempt } from './login-rate-limit';
import { verifySillyTavernAccount } from './sillytavern-account';

interface LoginBody {
    handle?: unknown;
    password?: unknown;
}

export type LoginAuthenticationResult =
    | { kind: 'disabled' }
    | { kind: 'authenticated'; accessScope: AccessScope }
    | { kind: 'invalid-request'; message: string }
    | { kind: 'invalid-credentials' }
    | { kind: 'rate-limited'; retryAfter: number };

function readCredentials(body: unknown): { handle: string | null; password: string | null } {
    if (!body || typeof body !== 'object') {
        return { handle: null, password: null };
    }

    const handle = (body as LoginBody).handle;
    const password = (body as LoginBody).password;
    return {
        handle: typeof handle === 'string' ? handle.trim() : null,
        password: typeof password === 'string' ? password : null,
    };
}

/** Authenticate a login body using the policy for the active transport mode. */
export async function authenticateLogin(
    body: unknown,
    clientAddress = 'unknown',
): Promise<LoginAuthenticationResult> {
    const config = getConfig();
    const credentials = readCredentials(body);

    if (config.env.HTTP_MODE && config.sillytavern.enableUserAccounts) {
        const retryAfter = consumeLoginAttempt(clientAddress);
        if (retryAfter !== null) {
            return { kind: 'rate-limited', retryAfter };
        }
        if (!credentials.handle || credentials.password === null) {
            return {
                kind: 'invalid-request',
                message: 'Request body must include string handle and password fields.',
            };
        }

        const valid = await verifySillyTavernAccount(
            config.sillytavern.dataRoot,
            credentials.handle,
            credentials.password,
        );
        if (!valid) {
            return { kind: 'invalid-credentials' };
        }

        clearLoginAttempts(clientAddress);
        return {
            kind: 'authenticated',
            accessScope: { kind: 'user', handle: credentials.handle },
        };
    }

    if (!isApiPasswordEnabled()) {
        return { kind: 'disabled' };
    }
    if (credentials.password === null) {
        return {
            kind: 'invalid-request',
            message: 'Request body must include a string password.',
        };
    }
    if (!verifyApiPassword(credentials.password)) {
        return { kind: 'invalid-credentials' };
    }

    return { kind: 'authenticated', accessScope: { kind: 'server' } };
}
