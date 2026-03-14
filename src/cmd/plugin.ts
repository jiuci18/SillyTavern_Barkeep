import { Router } from 'express';
import { Chalk } from 'chalk';
import { getConfig, loadConfig } from '../config/config';
import { startStandaloneHttpServer, stopStandaloneHttpServer } from './transport/http';
import { registerSillyTavernRouter } from './transport/router';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

/**
 * Initialize the plugin.
 * @param router Express Router
 */
export async function init(router: Router): Promise<void> {
    await loadConfig();
    const config = getConfig();

    if (config.env.HTTP_MODE) {
        await startStandaloneHttpServer(config.env.BARKEEPER_LISTEN ?? '0.0.0.0:10024');
        return;
    }

    registerSillyTavernRouter(router);

    console.log(chalk.green(MODULE_NAME), '[Main]Plugin loaded! (SillyTavern router mode)');
}

export async function exit(): Promise<void> {
    await stopStandaloneHttpServer();
    console.log(chalk.yellow(MODULE_NAME), '[Main]Plugin exited');
}
