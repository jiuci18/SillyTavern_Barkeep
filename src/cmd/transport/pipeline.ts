//! Shared transport pipeline for API routing, auth, body parsing, CORS, and serialization.

import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Readable } from 'stream';
import type { AccessScope, ApiRouteDefinition, ApiRouteResult } from '../../types/api';
import { Chalk } from 'chalk';
import { getConfig } from '../../config/config';
import { authorizeApiRequest, authorizeRouteUser } from '../../middleware/auth';
import { createNotFoundResponse } from '../../utils/api-response';
import { AppError, ErrorCode, createApiErrorResponse } from '../../utils/errors';
import { executeApiRoute, matchApiRoute } from '../api';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

interface HeaderWritable {
    setHeader: (name: string, value: string) => void;
}

interface SerializedApiResponse {
    statusCode: number;
    headers?: Record<string, string>;
    body?: Buffer | string;
}

/** Request shape required by the API transport pipeline. */
export interface ApiTransportRequest {
    method: string;
    path: string;
    authorization?: string;
    origin?: string;
    contentLength?: number;
    stream: Readable;
    accessScope?: AccessScope;
    clientAddress?: string;
}

const DEFAULT_CORS_METHODS = 'GET,POST,PUT,DELETE,OPTIONS';
const DEFAULT_CORS_HEADERS = 'Content-Type, Authorization, X-CSRF-Token';

/** Maximum accepted API request body size used by every transport. */
export const API_BODY_LIMIT_BYTES = 50 * 1024 * 1024;

/** Human-readable request body limit used in error responses. */
export const API_BODY_LIMIT_LABEL = '50mb';

function getCorsAllowlist(): string[] {
    const config = getConfig();
    if (!config.env.HTTP_MODE) {
        return config.sillytavern.corsEnabled ? config.sillytavern.corsOrigins : [];
    }

    return config.main.sys_conf.safe_conf.cors_allow_hostlist;
}

function resolveAllowedOrigin(origin?: string): string | null {
    if (!origin) {
        return null;
    }

    const allowlist = getCorsAllowlist();
    if (allowlist.includes('*') || allowlist.includes(origin)) {
        return origin;
    }

    return null;
}

function createCorsHeaders(origin?: string): Record<string, string> {
    const allowedOrigin = resolveAllowedOrigin(origin);
    if (!allowedOrigin) {
        if (origin) {
            console.log(
                chalk.yellow(MODULE_NAME),
                `[CORS]Origin "${origin}" not in allowlist — blocking`,
            );
        }
        return {};
    }

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': DEFAULT_CORS_METHODS,
        'Access-Control-Allow-Headers': DEFAULT_CORS_HEADERS,
        Vary: 'Origin',
    };
}

function withTransportHeaders(result: ApiRouteResult, req: ApiTransportRequest): ApiRouteResult {
    return {
        ...result,
        headers: { ...createCorsHeaders(req.origin), ...result.headers },
    };
}

/** Return true when a request method is an API CORS preflight. */
export function isPreflightRequest(method?: string): boolean {
    return (method ?? 'GET').toUpperCase() === 'OPTIONS';
}

/** Return the URL path without query string for standalone HTTP requests. */
export function getPathFromUrl(rawUrl?: string): string {
    const [path] = (rawUrl ?? '/').split('?');
    return path || '/';
}

function createRequestBodyTooLargeError(): AppError {
    return new AppError(
        ErrorCode.RequestBodyTooLarge,
        `Request body exceeds the ${API_BODY_LIMIT_LABEL} limit.`,
        413,
    );
}

function parseContentLength(value: string | string[] | undefined): number | undefined {
    if (Array.isArray(value)) {
        throw new AppError(
            ErrorCode.InvalidContentLength,
            'Multiple Content-Length headers are not allowed.',
            400,
        );
    }

    if (value === undefined) {
        return undefined;
    }

    const size = Number(value);
    return Number.isFinite(size) && size >= 0 ? size : undefined;
}

async function readRequestBody(req: ApiTransportRequest): Promise<Buffer> {
    if (req.contentLength !== undefined && req.contentLength > API_BODY_LIMIT_BYTES) {
        throw createRequestBodyTooLargeError();
    }

    const chunks: Buffer[] = [];
    let received = 0;

    for await (const chunk of req.stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buffer.length;

        if (received > API_BODY_LIMIT_BYTES) {
            throw createRequestBodyTooLargeError();
        }

        chunks.push(buffer);
    }

    return Buffer.concat(chunks, received);
}

async function parseJsonBody(req: ApiTransportRequest): Promise<unknown> {
    const rawBody = await readRequestBody(req);
    if (rawBody.length === 0) {
        return {};
    }

    return JSON.parse(rawBody.toString('utf8'));
}

async function parseRouteBody(req: ApiTransportRequest, route: ApiRouteDefinition): Promise<unknown> {
    if (route.bodyMode === 'raw') {
        return readRequestBody(req);
    }

    if (route.requiresJsonBody || route.bodyMode === 'json') {
        return parseJsonBody(req);
    }

    return undefined;
}

/** Execute route matching, auth, body parsing, handlers, and error mapping for any API transport. */
export async function handleApiTransportRequest(req: ApiTransportRequest): Promise<ApiRouteResult> {
    try {
        if (isPreflightRequest(req.method)) {
            return withTransportHeaders({ statusCode: 204 }, req);
        }

        const routeMatch = matchApiRoute(req.method, req.path);
        const authorization = authorizeApiRequest(
            routeMatch?.route ?? null,
            req.authorization,
            req.accessScope,
        );
        if (authorization.rejection) {
            return withTransportHeaders(authorization.rejection, req);
        }

        if (!routeMatch) {
            return withTransportHeaders(createNotFoundResponse(), req);
        }

        const userRejection = authorizeRouteUser(routeMatch.params, authorization.accessScope);
        if (userRejection) {
            return withTransportHeaders(userRejection, req);
        }

        const body = await parseRouteBody(req, routeMatch.route);
        const result = await executeApiRoute(
            routeMatch.route,
            body,
            routeMatch.params,
            req.path,
            req.clientAddress,
        );
        return withTransportHeaders(result, req);
    } catch (error) {
        return withTransportHeaders(createApiErrorResponse(error), req);
    }
}

function applyHeaders(target: HeaderWritable, headers?: Record<string, string>): void {
    if (!headers) {
        return;
    }

    for (const [name, value] of Object.entries(headers)) {
        target.setHeader(name, value);
    }
}

function serializeApiResult(result: ApiRouteResult): SerializedApiResponse {
    if (result.body === undefined) {
        return { statusCode: result.statusCode, headers: result.headers };
    }

    if (Buffer.isBuffer(result.body)) {
        return { statusCode: result.statusCode, headers: result.headers, body: result.body };
    }

    return {
        statusCode: result.statusCode,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...result.headers },
        body: JSON.stringify(result.body),
    };
}

/** Write an API result through Express using the transport response serializer. */
export function writeExpressResponse(res: Response, result: ApiRouteResult): void {
    const serialized = serializeApiResult(result);
    applyHeaders(res, serialized.headers);
    res.status(serialized.statusCode).end(serialized.body);
}

/** Write an API result through Node HTTP using the shared response serializer. */
export function writeHttpResponse(res: ServerResponse, result: ApiRouteResult): void {
    const serialized = serializeApiResult(result);
    applyHeaders(res, serialized.headers);
    res.statusCode = serialized.statusCode;
    res.end(serialized.body);
}

/** Create the transport request shape from an Express request. */
export function createExpressTransportRequest(req: Request): ApiTransportRequest {
    const user = (req as Request & {
        user?: { profile?: { handle?: unknown } };
    }).user;
    const handle = user?.profile?.handle;

    return {
        method: req.method,
        path: req.path,
        authorization: Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization,
        origin: req.header('origin') ?? undefined,
        contentLength: parseContentLength(req.headers['content-length']),
        stream: req,
        accessScope: typeof handle === 'string'
            ? { kind: 'user', handle }
            : undefined,
        clientAddress: req.ip,
    };
}

/** Create the transport request shape from a Node HTTP request. */
export function createHttpTransportRequest(req: IncomingMessage): ApiTransportRequest {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;

    return {
        method: req.method ?? 'GET',
        path: getPathFromUrl(req.url),
        authorization: Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization,
        origin,
        contentLength: parseContentLength(req.headers['content-length']),
        stream: req,
        clientAddress: req.socket.remoteAddress,
    };
}
