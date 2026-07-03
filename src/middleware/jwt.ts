import crypto from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { getConfig } from '../config/config';
import { isApiPasswordEnabled } from '../service/auth/api-password';
import type { AccessScope } from '../types/api';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const ACCESS_TOKEN_ISSUER = 'sillytavern-barkeep';
const ACCESS_TOKEN_AUDIENCE = 'barkeep-api';
const USER_TOKEN_SCOPE = 'api:user';
const SERVER_TOKEN_SCOPE = 'api:server';
let jwtSecret: string | null = null;

export interface AccessTokenClaims extends JwtPayload {
    scope: string;
}

function getJwtSecret(): string {
    if (!jwtSecret) {
        const envSecret = getConfig().env.JWT_SECRET?.trim();
        jwtSecret = (envSecret && envSecret.length > 0)
            ? envSecret
            : crypto.randomBytes(64).toString('hex');
    }
    return jwtSecret;
}

/** Return whether standalone requests must present a Barkeep access token. */
export function isTokenAuthEnabled(): boolean {
    const config = getConfig();
    if (config.env.API_PASSWORD_FORCE) {
        return true;
    }
    return config.env.HTTP_MODE
        && (config.sillytavern.enableUserAccounts || isApiPasswordEnabled());
}

export function getAccessTokenTtlSeconds(): number {
    return ACCESS_TOKEN_TTL_SECONDS;
}

/** Create a token constrained to one user or to the standalone server. */
export function createAccessToken(accessScope: AccessScope): string {
    const scope = accessScope.kind === 'user' ? USER_TOKEN_SCOPE : SERVER_TOKEN_SCOPE;
    const subject = accessScope.kind === 'user' ? accessScope.handle : 'api-client';

    return jwt.sign({ scope }, getJwtSecret(), {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        subject,
    });
}

/** Verify a token and recover its authorization scope. */
export function verifyAccessToken(token: string): AccessScope | null {
    try {
        const decoded = jwt.verify(token, getJwtSecret(), {
            algorithms: ['HS256'],
            issuer: ACCESS_TOKEN_ISSUER,
            audience: ACCESS_TOKEN_AUDIENCE,
        });

        if (typeof decoded === 'string') {
            return null;
        }

        const claims = decoded as AccessTokenClaims;
        if (claims.scope === SERVER_TOKEN_SCOPE && claims.sub === 'api-client') {
            return { kind: 'server' };
        }
        if (claims.scope === USER_TOKEN_SCOPE && typeof claims.sub === 'string' && claims.sub.length > 0) {
            return { kind: 'user', handle: claims.sub };
        }

        return null;
    } catch {
        return null;
    }
}

export function readBearerToken(authorizationHeader: string | string[] | undefined): string | null {
    const value = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
    if (!value) {
        return null;
    }

    const [scheme, token, ...rest] = value.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
        return null;
    }

    return token;
}
