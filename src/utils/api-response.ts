import { Chalk } from 'chalk';
import type { ApiRouteResult } from '../types/api';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

export function createNotFoundResponse(): ApiRouteResult {
    return {
        statusCode: 404,
        body: { error: 'Not Found' },
    };
}

export function createInternalErrorResponse(error?: unknown): ApiRouteResult {
    console.error(chalk.red(MODULE_NAME), 'Request failed', error);
    return {
        statusCode: 500,
        body: { error: 'Internal Server Error' },
    };
}
