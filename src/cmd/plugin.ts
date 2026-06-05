import { Router } from 'express';
import { Chalk } from 'chalk';
import { getConfig, loadConfig } from '../config/config';
import { runDatabaseMigrations } from './migration';
import { startStandaloneHttpServer, stopStandaloneHttpServer } from './transport/standalone';
import { registerExpressTransport } from './transport/express';
import { startFileWatcher, stopFileWatcher } from '../service/watch/file-watcher';
import { closeDatabase } from '../db/connection';

const chalk = new Chalk();
const MODULE_NAME = '[Sillytavern_Barkeeper]';

/**
 * Initialize the plugin.
 * @param router Express Router
 */
export async function init(router: Router): Promise<void> {
    await loadConfig();
    await runDatabaseMigrations();
    await startFileWatcher();
    const config = getConfig();

    if (config.env.HTTP_MODE) {
        await startStandaloneHttpServer(config.env.BARKEEPER_LISTEN ?? '0.0.0.0:10024');
        return;
    }

    registerExpressTransport(router);

    console.log(chalk.green(MODULE_NAME), '[Main]Plugin loaded! (SillyTavern router mode)');
}

export async function exit(): Promise<void> {
    await stopFileWatcher();
    await stopStandaloneHttpServer();
    closeDatabase();
    console.log(chalk.yellow(MODULE_NAME), '[Main]Plugin exited');
}
