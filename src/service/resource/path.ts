//! Safe resolution of SillyTavern user resource paths.

import path from 'path';
import fs from 'fs/promises';
import { getConfig, PRESET_DIRECTORIES } from '../../config/config';
import type { ResourceType } from '../../types/resource';
import { ErrorCode, createBadRequestError } from '../../utils/errors';
import { assertSafeUserHandle } from '../../utils/user';

const DEFAULT_SINGLE_USER_HANDLE = 'default-user';

function resolveEffectiveUserHandle(user: string): string {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    if (!config.sillytavern.enableUserAccounts) {
        return DEFAULT_SINGLE_USER_HANDLE;
    }

    return assertSafeUserHandle(user);
}

/** Resolve the data directory for a request user, respecting single-user mode. */
export function resolveUserDirectory(user: string): { safeUser: string; userDirectory: string } {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    const safeUser = resolveEffectiveUserHandle(user);
    return {
        safeUser,
        userDirectory: path.join(config.sillytavern.dataRoot, safeUser),
    };
}

function normalizeRelativePath(relativePath: string): string | null {
    if (path.isAbsolute(relativePath) || relativePath.trim().length === 0) {
        return null;
    }

    const normalized = path.normalize(relativePath).replace(/\\/g, '/');
    if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
        return null;
    }

    return normalized;
}

function isPathAllowedForType(fileType: ResourceType, relativePath: string): boolean {
    const [firstSegment] = relativePath.split('/');

    switch (fileType) {
        case 'characters':
            return firstSegment === 'characters';
        case 'worlds':
            return firstSegment === 'worlds';
        case 'chats':
            return firstSegment === 'chats' || firstSegment === 'group chats';
        case 'presets':
            return PRESET_DIRECTORIES.has(firstSegment);
    }
}

/** Resolve and validate a resource path under the user's SillyTavern data directory. */
export function resolveResourcePath(user: string, fileType: ResourceType, relativePath: string) {
    const normalizedPath = normalizeRelativePath(relativePath);
    if (!normalizedPath || !isPathAllowedForType(fileType, normalizedPath)) {
        throw createBadRequestError(ErrorCode.InvalidResourcePath, 'Invalid resource path.');
    }

    const { safeUser, userDirectory } = resolveUserDirectory(user);
    const absolutePath = path.join(userDirectory, normalizedPath);
    const relativeToUser = path.relative(userDirectory, absolutePath);

    if (relativeToUser.startsWith('..') || path.isAbsolute(relativeToUser)) {
        throw createBadRequestError(ErrorCode.InvalidResourcePath, 'Invalid resource path.');
    }

    return {
        safeUser,
        userDirectory,
        relativePath: normalizedPath,
        absolutePath,
    };
}

function isPathInsideDirectory(directoryPath: string, targetPath: string): boolean {
    const relativePath = path.relative(directoryPath, targetPath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

export interface ResolvedResourcePath {
    safeUser: string;
    userDirectory: string;
    relativePath: string;
    absolutePath: string;
}

/** Ensure an existing resource resolves inside the real user directory, including symlink expansion. */
export async function assertExistingResourceInsideUserDirectory(resolved: ResolvedResourcePath): Promise<void> {
    const [realUserDirectory, realResourcePath] = await Promise.all([
        fs.realpath(resolved.userDirectory),
        fs.realpath(resolved.absolutePath),
    ]);

    if (!isPathInsideDirectory(realUserDirectory, realResourcePath)) {
        throw createBadRequestError(ErrorCode.InvalidResourcePath, 'Resource path escapes user directory.');
    }
}

/** Ensure a future write target's real parent directory stays inside the real user directory. */
export async function assertWritableResourceInsideUserDirectory(resolved: ResolvedResourcePath): Promise<void> {
    const parentDirectory = path.dirname(resolved.absolutePath);
    await fs.mkdir(parentDirectory, { recursive: true });

    const [realUserDirectory, realParentDirectory] = await Promise.all([
        fs.realpath(resolved.userDirectory),
        fs.realpath(parentDirectory),
    ]);

    if (!isPathInsideDirectory(realUserDirectory, realParentDirectory)) {
        throw createBadRequestError(ErrorCode.InvalidResourcePath, 'Resource path escapes user directory.');
    }
}
