import http, { IncomingMessage, ServerResponse } from 'http';
import { Chalk } from 'chalk';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';
let standaloneServer: http.Server | null = null;

function setCorsHeaders(res: { setHeader: (name: string, value: string) => void }): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Test-Header');
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
    setCorsHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
}

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

async function readRequestBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function handleStandaloneRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const path = (req.url ?? '/').split('?')[0];

    if (method === 'OPTIONS' && path === '/cors-test') {
        setCorsHeaders(res);
        res.statusCode = 204;
        res.end();
        return;
    }

    if (method === 'GET' && path === '/cors-test') {
        sendJson(res, 200, { ok: true, ts: Date.now() });
        return;
    }

    if (method === 'POST' && path === '/probe') {
        setCorsHeaders(res);
        res.statusCode = 204;
        res.end();
        return;
    }

    if (method === 'POST' && path === '/ping') {
        try {
            const rawBody = await readRequestBody(req);
            const body = rawBody ? JSON.parse(rawBody) : {};
            const message = typeof body.message === 'string' ? body.message : '';
            sendJson(res, 200, { message: `Pong! ${message}` });
        } catch (error) {
            console.error(chalk.red(MODULE_NAME), 'Request failed', error);
            sendJson(res, 500, { error: 'Internal Server Error' });
        }
        return;
    }

    sendJson(res, 404, { error: 'Not Found' });
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
