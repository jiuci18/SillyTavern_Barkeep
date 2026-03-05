import http, { IncomingMessage } from 'http';
import { Chalk } from 'chalk';
import { dispatchApiRequest, getApiRoute, internalErrorResponse } from '../api';
import { writeHttpResponse } from './response';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';
let standaloneServer: http.Server | null = null;

function parseListenAddress(listen: string): { host: string; port: number } {
    const defaultAddr = { host: '0.0.0.0', port: 10024 };
    const value = listen.trim();

    if (!value) {
        return defaultAddr;
    }

    const lastColon = value.lastIndexOf(':');
    if (lastColon <= 0 || lastColon === value.length - 1) {
        throw new Error(`Invalid BARKEEPER_LISTEN format: "${listen}". Expected "host:port".`);
    }

    const host = value.slice(0, lastColon).trim();
    const port = Number(value.slice(lastColon + 1));

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid BARKEEPER_LISTEN value: "${listen}".`);
    }

    return { host, port };
}

function getPathFromUrl(rawUrl?: string): string {
    const [path] = (rawUrl ?? '/').split('?');
    return path || '/';
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
    const rawBody = await readRequestBody(req);
    return rawBody ? JSON.parse(rawBody) : {};
}

async function handleStandaloneRequest(req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
        const method = req.method ?? 'GET';
        const path = getPathFromUrl(req.url);
        const route = getApiRoute(method, path);

        let body: unknown = undefined;
        if (route?.requiresJsonBody) {
            body = await parseJsonBody(req);
        }

        const result = await dispatchApiRequest(method, path, body);
        writeHttpResponse(res, result);
    } catch (error) {
        writeHttpResponse(res, internalErrorResponse(error));
    }
}

export async function startStandaloneHttpServer(listen: string): Promise<void> {
    if (standaloneServer) {
        return;
    }

    const { host, port } = parseListenAddress(listen);

    standaloneServer = http.createServer((req, res) => {
        void handleStandaloneRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
        standaloneServer?.once('error', reject);
        standaloneServer?.listen(port, host, () => {
            standaloneServer?.off('error', reject);
            resolve();
        });
    });

    console.log(chalk.green(MODULE_NAME), `HTTP server started at http://${host}:${port}`);
}

export async function stopStandaloneHttpServer(): Promise<void> {
    if (!standaloneServer) {
        return;
    }

    const serverToClose = standaloneServer;
    standaloneServer = null;

    await new Promise<void>((resolve, reject) => {
        serverToClose.close((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}
