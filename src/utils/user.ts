//! User handle validation helpers.

import { ErrorCode, createBadRequestError } from './errors';

/** Return a trimmed safe user handle or throw a typed bad-request error. */
export function assertSafeUserHandle(user: string): string {
    const value = user.trim();

    if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
        throw createBadRequestError(ErrorCode.InvalidUserHandle, 'Invalid user handle.');
    }

    return value;
}
