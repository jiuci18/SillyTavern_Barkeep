import bodyParser from 'body-parser';
import { Router } from 'express';
import { Chalk } from 'chalk';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

function setCorsHeaders(res: { setHeader: (name: string, value: string) => void }): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Test-Header');
}

export function registerSillyTavernRouter(router: Router): void {
    const jsonParser = bodyParser.json();

    router.options('/cors-test', (_req, res) => {
        setCorsHeaders(res);
        return res.sendStatus(204);
    });

    router.get('/cors-test', (_req, res) => {
        setCorsHeaders(res);
        return res.json({ ok: true, ts: Date.now() });
    });

    router.post('/probe', (_req, res) => {
        return res.sendStatus(204);
    });

    router.post('/ping', jsonParser, async (req, res) => {
        try {
            const { message } = req.body;
            return res.json({ message: `Pong! ${message}` });
        } catch (error) {
            console.error(chalk.red(MODULE_NAME), 'Request failed', error);
            return res.status(500).send('Internal Server Error');
        }
    });
}
