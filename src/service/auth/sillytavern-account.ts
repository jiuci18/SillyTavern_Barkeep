//! Local verification of SillyTavern account credentials.

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface StoredAccount {
    handle: string;
    password?: string;
    salt?: string;
    enabled: boolean;
}

interface PersistedValue<T> {
    key: string;
    value: T;
}

function accountStoragePath(dataRoot: string, handle: string): string {
    const key = `user:${handle}`;
    const fileName = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(dataRoot, '_storage', fileName);
}

function equalEncodedHash(actual: string, expected: string): boolean {
    const actualBytes = Buffer.from(actual, 'base64');
    const expectedBytes = Buffer.from(expected, 'base64');
    return actualBytes.length === expectedBytes.length
        && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

/** Verify credentials against SillyTavern's local node-persist account record. */
export async function verifySillyTavernAccount(
    dataRoot: string,
    handle: string,
    password: string,
): Promise<boolean> {
    const key = `user:${handle}`;

    try {
        const raw = await fs.readFile(accountStoragePath(dataRoot, handle), 'utf8');
        const stored = JSON.parse(raw) as PersistedValue<StoredAccount>;
        const account = stored.value;

        if (stored.key !== key
            || account.handle !== handle
            || !account.enabled
            || !account.password
            || !account.salt) {
            return false;
        }

        const actualHash = crypto.scryptSync(password.normalize(), account.salt, 64).toString('base64');
        return equalEncodedHash(actualHash, account.password);
    } catch {
        return false;
    }
}
