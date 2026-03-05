import { Router } from 'express';
import { exit, init } from './cmd/plugin';

interface PluginInfo {
    id: string;
    name: string;
    description: string;
}

interface Plugin {
    init: (router: Router) => Promise<void>;
    exit: () => Promise<void>;
    info: PluginInfo;
}

export const info: PluginInfo = {
    id: 'barkeep',
    name: 'sillytavern api',
    description: 'A api servers for SillyTavern server.',
};

const plugin: Plugin = {
    init,
    exit,
    info,
};

export { init, exit };
export default plugin;
