//! Error contracts shared by API handlers and transports.

import type { ApiRouteResult } from '../types/api';
import { createBadRequestResponse, createInternalErrorResponse, createPayloadTooLargeResponse } from './api-response';

/** Stable application error codes returned by API transports. */
export enum ErrorCode {
    InvalidResourcePath = 'INVALID_RESOURCE_PATH',
    InvalidUserHandle = 'INVALID_USER_HANDLE',
    ResourceNotFile = 'RESOURCE_NOT_FILE',
    UserNotFound = 'USER_NOT_FOUND',
    RequestBodyTooLarge = 'REQUEST_BODY_TOO_LARGE',
    InvalidContentLength = 'INVALID_CONTENT_LENGTH',
    MappingNotFound = 'MAPPING_NOT_FOUND',
    UnknownResourceType = 'UNKNOWN_RESOURCE_TYPE',
    PendingUpload = 'PENDING_UPLOAD',
    UnresolvedPath = 'UNRESOLVED_PATH',
    FileNotFound = 'FILE_NOT_FOUND',
}

/** Error codes serialized as HTTP 400 responses. */
export type BadRequestErrorCode =
    | ErrorCode.InvalidResourcePath
    | ErrorCode.InvalidUserHandle
    | ErrorCode.ResourceNotFile
    | ErrorCode.InvalidContentLength;

/** Error codes serialized as HTTP 404 responses. */
export type NotFoundErrorCode = ErrorCode.UserNotFound;

/** HTTP class used for known application failures. */
export type ErrorStatusCode = 400 | 404 | 413;

/** Error carrying a typed, transport-stable application code. */
export class AppError extends Error {
    /** Stable application error code. */
    public readonly code: ErrorCode;

    /** HTTP status code used when serializing this error. */
    public readonly statusCode: ErrorStatusCode;

    /** Create a typed application error for API boundary serialization. */
    public constructor(code: ErrorCode, message: string, statusCode: ErrorStatusCode) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

interface RequestBodyError extends Error {
    type?: string;
    status?: number;
    statusCode?: number;
}

function isError(error: unknown): error is RequestBodyError {
    return error instanceof Error;
}

/** Create a bad-request application error. */
export function createBadRequestError(code: BadRequestErrorCode, message: string): AppError {
    return new AppError(code, message, 400);
}

/** Create a not-found application error. */
export function createNotFoundError(code: NotFoundErrorCode, message: string): AppError {
    return new AppError(code, message, 404);
}

/** Return true when the failure came from JSON parsing. */
export function isJsonBodyError(error: unknown): boolean {
    if (!isError(error)) {
        return false;
    }

    return error instanceof SyntaxError || error.type === 'entity.parse.failed';
}

/** Return true when the request body exceeds the configured transport limit. */
export function isPayloadTooLargeError(error: unknown): boolean {
    if (!isError(error)) {
        return false;
    }

    return error.type === 'entity.too.large'
        || error.status === 413
        || error.statusCode === 413
        || (error instanceof AppError && error.code === ErrorCode.RequestBodyTooLarge);
}

// ---------------------------------------------------------------------------
// Resource handler error factories — keep error shape consistent across GET / POST / DELETE
// ---------------------------------------------------------------------------

/** 404 — no mapping registered for this UUID at all. */
export function createMappingNotFoundResponse(advice: string): ApiRouteResult {
    return {
        statusCode: 404,
        body: {
            error: 'Resource mapping is not found.',
            code: ErrorCode.MappingNotFound,
            advice,
        },
    };
}

/** 409 — mapping exists but fileType is 'unknown' (dirty migration residue). */
export function createUnknownResourceTypeResponse(uuid: string, advice: string): ApiRouteResult {
    return {
        statusCode: 409,
        body: {
            error: 'Resource mapping type is unknown.',
            code: ErrorCode.UnknownResourceType,
            uuid,
            advice,
        },
    };
}

/** 409 — mapping is registered but file content was never uploaded. */
export function createPendingUploadResponse(uuid: string, advice: string): ApiRouteResult {
    return {
        statusCode: 409,
        body: {
            error: 'Resource is pending upload.',
            code: ErrorCode.PendingUpload,
            uuid,
            advice,
        },
    };
}

/** 409 — mapping points to a path that no longer exists on disk. */
export function createUnresolvedPathResponse(uuid: string, previousPath: string, advice: string): ApiRouteResult {
    return {
        statusCode: 409,
        body: {
            error: 'Resource mapping is unresolved.',
            code: ErrorCode.UnresolvedPath,
            uuid,
            previousPath,
            advice,
        },
    };
}

/** 404 — mapping exists but the file was explicitly deleted (status: not-found). */
export function createFileNotFoundResponse(uuid: string, advice: string): ApiRouteResult {
    return {
        statusCode: 404,
        body: {
            error: 'Resource file is not found.',
            code: ErrorCode.FileNotFound,
            uuid,
            status: 'not-found',
            advice,
        },
    };
}

/** Convert known domain/request errors into stable API responses. */
export function createApiErrorResponse(error: unknown): ApiRouteResult {
    if (isPayloadTooLargeError(error)) {
        return createPayloadTooLargeResponse('Request body exceeds the 50mb limit.');
    }

    if (isJsonBodyError(error)) {
        return createBadRequestResponse('Invalid JSON request body.');
    }

    if (!isError(error)) {
        return createInternalErrorResponse(error);
    }

    if (error instanceof AppError) {
        return {
            statusCode: error.statusCode,
            body: { error: error.message, code: error.code },
        };
    }

    return createInternalErrorResponse(error);
}
