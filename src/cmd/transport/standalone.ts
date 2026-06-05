//! Standalone Node HTTP server adapter for the shared API pipeline.

import http from 'http';
import { Chalk } from 'chalk';
import { createApiErrorResponse } from '../../utils/errors';
import { createHttpTransportRequest, handleApiTransportRequest, writeHttpResponse } from './pipeline';

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

async function handleStandaloneRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
        const result = await handleApiTransportRequest(createHttpTransportRequest(req));
        writeHttpResponse(res, result);
    } catch (error) {
        writeHttpResponse(res, createApiErrorResponse(error));
    }
}

/** Start the standalone HTTP server unless it is already running. */
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

    console.log(chalk.green(MODULE_NAME), `[Http]HTTP server started at http://${host}:${port}`);
}

/** Stop the standalone HTTP server if it is running. */
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
