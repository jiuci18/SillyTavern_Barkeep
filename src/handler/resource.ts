//! Resource CRUD handlers keyed by stable UUID mappings.

import fs from 'fs/promises';
import type { ApiRouteContext, ApiRouteResult } from '../types/api';
import type { ResourceType } from '../types/resource';
import { findMappingByUuid, markMappingStatus, updateMappingContent } from '../db/file-mapping';
import { writeResourceFile } from '../service/resource/file';
import {
    assertExistingResourceInsideUserDirectory,
    assertWritableResourceInsideUserDirectory,
    resolveResourcePath,
    resolveUserDirectory,
} from '../service/resource/path';
import { parseResourceType } from '../service/resource/type';
import { createBadRequestResponse } from '../utils/api-response';
import {
    createMappingNotFoundResponse,
    createUnknownResourceTypeResponse,
    createPendingUploadResponse,
    createUnresolvedPathResponse,
    createFileNotFoundResponse,
} from '../utils/errors';

function getRouteResourceType(params: Record<string, string>): ResourceType | null {
    return parseResourceType(params.resource);
}

async function readExistingFile(filePath: string): Promise<Buffer | null> {
    try {
        return await fs.readFile(filePath);
    } catch {
        return null;
    }
}

function getContentType(fileType: ResourceType): string {
    switch (fileType) {
        case 'characters':
            return 'application/octet-stream';
        case 'worlds':
        case 'presets':
        case 'chats':
            return 'application/json; charset=utf-8';
    }
}

function getRawBody(body: unknown): Buffer | null {
    return Buffer.isBuffer(body) ? body : null;
}

function isNotFoundFsError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/** Read resource bytes by UUID. */
export async function handleResourceGet({ params }: ApiRouteContext): Promise<ApiRouteResult> {
    const fileType = getRouteResourceType(params);
    if (!fileType) {
        return createBadRequestResponse('Invalid resource type.');
    }

    const { safeUser } = resolveUserDirectory(params.user);
    const mapping = findMappingByUuid(safeUser, params.uuid);
    if (!mapping) {
        return createMappingNotFoundResponse(
            'Register a new mapping via POST /api/src with the resource path before accessing it.',
        );
    }
    if (mapping.fileType === 'unknown') {
        return createUnknownResourceTypeResponse(
            mapping.uuid,
            'Delete this mapping and re-register the resource with an explicit type.',
        );
    }
    if (mapping.fileType !== fileType) {
        return createMappingNotFoundResponse(
            'Register a new mapping via POST /api/src with the resource path before accessing it.',
        );
    }

    if (mapping.status === 'pending') {
        return createPendingUploadResponse(
            mapping.uuid,
            'POST the file bytes to this resource endpoint to complete the upload.',
        );
    }

    if (mapping.status === 'unresolved') {
        return createUnresolvedPathResponse(
            mapping.uuid,
            mapping.filePath,
            'The file has been moved or deleted. Re-register the resource at its new path, or re-upload it.',
        );
    }

    if (mapping.status === 'not-found') {
        return createFileNotFoundResponse(
            mapping.uuid,
            'The file was previously deleted. Re-upload via POST to restore it.',
        );
    }

    const resolved = resolveResourcePath(params.user, fileType, mapping.filePath);

    const content = await readExistingFile(resolved.absolutePath);
    if (!content) {
        markMappingStatus(mapping.uuid, 'unresolved');
        return createUnresolvedPathResponse(
            mapping.uuid,
            mapping.filePath,
            'The file has been moved or deleted. Re-register the resource at its new path, or re-upload it.',
        );
    }
    try {
        await assertExistingResourceInsideUserDirectory(resolved);
    } catch (error) {
        if (isNotFoundFsError(error)) {
            markMappingStatus(mapping.uuid, 'unresolved');
            return createUnresolvedPathResponse(
                mapping.uuid,
                mapping.filePath,
                'The file has been moved or deleted. Re-register the resource at its new path, or re-upload it.',
            );
        }
        throw error;
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': getContentType(fileType),
            'X-Resource-UUID': mapping.uuid,
        },
        body: content,
    };
}

/** Write resource bytes by UUID, creating pending files when needed. */
export async function handleResourcePost({ body, params }: ApiRouteContext): Promise<ApiRouteResult> {
    const fileType = getRouteResourceType(params);
    const content = getRawBody(body);
    if (!fileType) {
        return createBadRequestResponse('Invalid resource type.');
    }
    if (!content) {
        return createBadRequestResponse('Request body must be raw file bytes.');
    }

    const { safeUser } = resolveUserDirectory(params.user);
    const mapping = findMappingByUuid(safeUser, params.uuid);
    if (!mapping) {
        return createMappingNotFoundResponse(
            'Register a new mapping via POST /api/src with the resource path before uploading.',
        );
    }
    if (mapping.fileType === 'unknown') {
        return createUnknownResourceTypeResponse(
            mapping.uuid,
            'Delete this mapping and re-register the resource with an explicit type.',
        );
    }
    if (mapping.fileType !== fileType) {
        return createMappingNotFoundResponse(
            'Register a new mapping via POST /api/src with the resource path before uploading.',
        );
    }

    const resolved = resolveResourcePath(params.user, fileType, mapping.filePath);
    await assertWritableResourceInsideUserDirectory(resolved);
    const metadata = await writeResourceFile(resolved.absolutePath, resolved.relativePath, content);
    updateMappingContent(mapping.uuid, metadata.size, metadata.hash, 'normal');

    return {
        statusCode: 200,
        body: {
            uuid: mapping.uuid,
            status: 'normal',
            metadata,
        },
    };
}

/** Delete the file for a resource UUID and mark its mapping not-found. */
export async function handleResourceDelete({ params }: ApiRouteContext): Promise<ApiRouteResult> {
    const fileType = getRouteResourceType(params);
    if (!fileType) {
        return createBadRequestResponse('Invalid resource type.');
    }

    const { safeUser } = resolveUserDirectory(params.user);
    const mapping = findMappingByUuid(safeUser, params.uuid);
    if (!mapping) {
        return createMappingNotFoundResponse(
            'Register a new mapping via POST /api/src with the resource path before deleting.',
        );
    }
    if (mapping.fileType === 'unknown') {
        return createUnknownResourceTypeResponse(
            mapping.uuid,
            'Delete this mapping and re-register the resource with an explicit type.',
        );
    }
    if (mapping.fileType !== fileType) {
        return createMappingNotFoundResponse(
            'Register a new mapping via POST /api/src with the resource path before deleting.',
        );
    }

    const resolved = resolveResourcePath(params.user, fileType, mapping.filePath);
    try {
        await assertExistingResourceInsideUserDirectory(resolved);
        await fs.unlink(resolved.absolutePath);
    } catch (error) {
        if (!isNotFoundFsError(error)) {
            throw error;
        }
        // Missing files are idempotent from the API perspective; the mapping still becomes not-found.
    }
    markMappingStatus(mapping.uuid, 'not-found');

    return {
        statusCode: 200,
        body: {
            uuid: mapping.uuid,
            status: 'not-found',
        },
    };
}
