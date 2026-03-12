import type { Response } from 'express';
import type { ServerResponse } from 'http';
import type { ApiRouteResult } from '../../types/api';

interface HeaderWritable {
    setHeader: (name: string, value: string) => void;
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
