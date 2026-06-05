import crypto from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { getConfig } from '../config/config';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const ACCESS_TOKEN_ISSUER = 'sillytavern-barkeep';
const ACCESS_TOKEN_AUDIENCE = 'barkeep-api';
const ACCESS_TOKEN_SCOPE = 'api';
let jwtSecret: string | null = null;

export interface AccessTokenClaims extends JwtPayload {
    scope: string;
}

function getConfiguredPassword(): string | null {
    const password = getConfig().env.API_PASSWORD ?? '';
    return password.trim().length > 0 ? password : null;
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

export function isPasswordAuthEnabled(): boolean {
    const env = getConfig().env;
    return env.API_PASSWORD_ENABLE && (env.API_PASSWORD?.trim().length ?? 0) > 0;
}

export function getAccessTokenTtlSeconds(): number {
    return ACCESS_TOKEN_TTL_SECONDS;
}

export function validateApiPassword(password: string): boolean {
    const expectedPassword = getConfiguredPassword();
    if (expectedPassword === null) {
        return false;
    }

    const actual = Buffer.from(password);
    const expected = Buffer.from(expectedPassword);

    if (actual.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(actual, expected);
}

export function createAccessToken(): string {
    return jwt.sign({ scope: ACCESS_TOKEN_SCOPE }, getJwtSecret(), {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        subject: 'api-client',
    });
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
        const decoded = jwt.verify(token, getJwtSecret(), {
            algorithms: ['HS256'],
            issuer: ACCESS_TOKEN_ISSUER,
            audience: ACCESS_TOKEN_AUDIENCE,
        });

        if (typeof decoded === 'string' || decoded.scope !== ACCESS_TOKEN_SCOPE) {
            return null;
        }

        return decoded as AccessTokenClaims;
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
