//! Error contracts shared by API handlers and transports.

import type { ApiRouteResult } from '../types/api';
import { createBadRequestResponse, createInternalErrorResponse } from './api-response';

interface CodedError extends Error {
    code?: string;
    type?: string;
}

function isError(error: unknown): error is CodedError {
    return error instanceof Error;
}

/** Return true when the failure came from JSON parsing. */
export function isJsonBodyError(error: unknown): boolean {
    if (!isError(error)) {
        return false;
    }

    return error instanceof SyntaxError || error.type === 'entity.parse.failed';
}

/** Convert known domain/request errors into stable API responses. */
export function createApiErrorResponse(error: unknown): ApiRouteResult {
    if (isJsonBodyError(error)) {
        return createBadRequestResponse('Invalid JSON request body.');
    }

    if (!isError(error)) {
        return createInternalErrorResponse(error);
    }

    switch (error.code) {
        case 'USER_NOT_FOUND':
            return {
                statusCode: 404,
                body: { error: error.message, code: error.code },
            };
        case 'INVALID_RESOURCE_PATH':
        case 'RESOURCE_NOT_FILE':
            return {
                statusCode: 400,
                body: { error: error.message, code: error.code },
            };
        default:
            break;
    }

    if (error.message === 'Invalid user handle.') {
        return {
            statusCode: 400,
            body: { error: error.message, code: 'INVALID_USER_HANDLE' },
        };
    }

    return createInternalErrorResponse(error);
}
