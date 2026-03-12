import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ApiRouteResult } from '../../types/api';
import { getConfig } from '../../config/config';
import { createNotFoundResponse } from '../../utils/api-response';
import { executeApiRoute, matchApiRoute } from '../api';

interface HeaderWritable {
    setHeader: (name: string, value: string) => void;
}

const DEFAULT_CORS_METHODS = 'GET,POST,OPTIONS';
const DEFAULT_CORS_HEADERS = 'Content-Type, Authorization, X-Test-Header';

function resolveAllowedOrigin(origin?: string): string | null {
    if (!origin) {
        return null;
    }

    const allowlist = getConfig().main.sys_conf.safe_conf.cors_allow_hostlist;
    if (allowlist.includes(origin)) {
        return origin;
    }

    return null;
}

function applyCorsHeaders(target: HeaderWritable, origin?: string): void {
    const allowedOrigin = resolveAllowedOrigin(origin);
    if (!allowedOrigin) {
        return;
    }

    target.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    target.setHeader('Access-Control-Allow-Methods', DEFAULT_CORS_METHODS);
    target.setHeader('Access-Control-Allow-Headers', DEFAULT_CORS_HEADERS);
    target.setHeader('Vary', 'Origin');
}

export function applyExpressCors(req: Request, res: Response): void {
    applyCorsHeaders(res, req.header('origin') ?? undefined);
}

export function applyHttpCors(req: IncomingMessage, res: ServerResponse): void {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    applyCorsHeaders(res, origin);
}

export function isPreflightRequest(method?: string): boolean {
    return (method ?? 'GET').toUpperCase() === 'OPTIONS';
}

export function getMatchedApiRoute(method: string, path: string) {
    return matchApiRoute(method, path);
}

export async function executeMatchedApiRequest(
    method: string,
    path: string,
    body?: unknown
): Promise<ApiRouteResult> {
    const routeMatch = getMatchedApiRoute(method, path);
    if (!routeMatch) {
        return createNotFoundResponse();
    }

    return executeApiRoute(routeMatch.route, body, routeMatch.params, path);
}

function applyHeaders(target: HeaderWritable, headers?: Record<string, string>): void {
    if (!headers) {
        return;
    }

    for (const [name, value] of Object.entries(headers)) {
        target.setHeader(name, value);
    }
}

export function writeExpressResponse(res: Response, result: ApiRouteResult): void {
    applyHeaders(res, result.headers);

    if (result.body === undefined) {
        res.status(result.statusCode).end();
        return;
    }

    res.status(result.statusCode).json(result.body);
}

export function writeHttpResponse(res: ServerResponse, result: ApiRouteResult): void {
    applyHeaders(res, result.headers);
    res.statusCode = result.statusCode;

    if (result.body === undefined) {
        res.end();
        return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result.body));
}
