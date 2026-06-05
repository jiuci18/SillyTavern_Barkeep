//! Source registration API: resolves user paths into stable UUID mappings.

import fs from 'fs/promises';
import type { ApiRouteContext, ApiRouteResult } from '../types/api';
import { createBadRequestResponse } from '../utils/api-response';
import { findMappingByPath, upsertNormalMapping, createPendingMapping } from '../db/file-mapping';
import { readFileMetadata } from '../service/resource/file';
import { assertExistingResourceInsideUserDirectory, resolveResourcePath } from '../service/resource/path';
import { parseResourceType } from '../service/resource/type';

function parseSourceBody(body: unknown): { type: ReturnType<typeof parseResourceType>; path: string | null; create: boolean } {
    if (!body || typeof body !== 'object') {
        return { type: null, path: null, create: false };
    }

    const source = body as Record<string, unknown>;
    return {
        type: parseResourceType(source.type),
        path: typeof source.path === 'string' ? source.path : null,
        create: source.create === true,
    };
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(filePath);
        return stat.isFile();
    } catch {
        return false;
    }
}

/** Return metadata and registration state for a user resource path. */
export async function handleSourceInfo({ body, params }: ApiRouteContext): Promise<ApiRouteResult> {
    const parsed = parseSourceBody(body);
    if (!parsed.type || !parsed.path) {
        return createBadRequestResponse('Request body must include string type and path.');
    }

    const resolved = resolveResourcePath(params.user, parsed.type, parsed.path);
    const mapping = findMappingByPath(resolved.safeUser, parsed.type, resolved.relativePath);

    if (!(await fileExists(resolved.absolutePath))) {
        return {
            statusCode: 200,
            body: {
                exists: false,
                registered: Boolean(mapping),
                mapping,
            },
        };
    }

    await assertExistingResourceInsideUserDirectory(resolved);
    const metadata = await readFileMetadata(resolved.absolutePath, resolved.relativePath);
    return {
        statusCode: 200,
        body: {
            exists: true,
            registered: Boolean(mapping),
            uuid: mapping?.uuid ?? null,
            type: parsed.type,
            ...metadata,
            mapping,
        },
    };
}

/** Register an existing file or create a pending mapping for a future upload. */
export async function handleSourceRegister({ body, params }: ApiRouteContext): Promise<ApiRouteResult> {
    const parsed = parseSourceBody(body);
    if (!parsed.type || !parsed.path) {
        return createBadRequestResponse('Request body must include string type and path.');
    }

    const resolved = resolveResourcePath(params.user, parsed.type, parsed.path);
    if (!(await fileExists(resolved.absolutePath))) {
        if (!parsed.create) {
            return {
                statusCode: 404,
                body: { error: 'Resource file is not found.' },
            };
        }

        return {
            statusCode: 201,
            body: createPendingMapping({
                user: resolved.safeUser,
                fileType: parsed.type,
                filePath: resolved.relativePath,
            }),
        };
    }

    await assertExistingResourceInsideUserDirectory(resolved);
    const metadata = await readFileMetadata(resolved.absolutePath, resolved.relativePath);
    const mapping = upsertNormalMapping({
        user: resolved.safeUser,
        fileType: parsed.type,
        filePath: resolved.relativePath,
        fileSize: metadata.size,
        fileHash: metadata.hash,
    });

    return {
        statusCode: 200,
        body: {
            ...mapping,
            metadata,
        },
    };
}
