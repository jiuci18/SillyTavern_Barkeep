//! Verification of the optional standalone Barkeep API password.

import crypto from 'crypto';
import { getConfig } from '../../config/config';

/** Return whether the optional standalone API password is configured. */
export function isApiPasswordEnabled(): boolean {
    const env = getConfig().env;
    const enabled = env.API_PASSWORD_ENABLE || env.API_PASSWORD_FORCE;
    return enabled && (env.API_PASSWORD?.trim().length ?? 0) > 0;
}

/** Compare a supplied password with the configured API password. */
export function verifyApiPassword(password: string): boolean {
    const configured = getConfig().env.API_PASSWORD?.trim();
    if (!configured) {
        return false;
    }

    const actual = Buffer.from(password);
    const expected = Buffer.from(configured);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
