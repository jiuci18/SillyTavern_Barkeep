import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import yaml from 'yaml';
import { EnvConfig, LoadedConfig, MainConfig, SillyTavernConfig } from '../types/config';

let cachedConfig: LoadedConfig | null = null;
let loadPromise: Promise<LoadedConfig> | null = null;

function getPluginRoot(): string {
    return path.resolve(__dirname, '..');
}

async function readJsonFile<T>(filePath: string): Promise<T> {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
}

async function readYamlFile<T>(filePath: string): Promise<T> {
    const raw = await fs.readFile(filePath, 'utf8');
    return yaml.parse(raw) as T;
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
        return defaultValue;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
        return true;
    }
    if (normalized === 'false' || normalized === '0') {
        return false;
    }

    return defaultValue;
}

function loadEnvConfig(): EnvConfig {
    const envPath = path.resolve(getPluginRoot(), '.env');
    dotenv.config({ path: envPath });
    return {
        API_PASSWORD: process.env.API_PASSWORD,
        BARKEEPER_CONFIG_PATH: process.env.BARKEEPER_CONFIG_PATH,
        BARKEEPER_LISTEN: process.env.BARKEEPER_LISTEN,
        HTTP_MODE: parseBooleanEnv(process.env.HTTP_MODE, true),
    };
}

async function loadSillyTavernConfig(confPath: string): Promise<SillyTavernConfig | null> {
    if (!confPath || confPath.trim().length === 0) {
        throw new Error('sillytavern_conf_path is empty. Please set it in data/config/main_conf.json.');
    }

    try {
        await fs.access(confPath);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            throw new Error(`SillyTavern config not found: ${confPath}`);
        }
        throw error;
    }

    const data = await readYamlFile<Record<string, unknown>>(confPath);
    const basicAuthMode = Boolean(data?.basicAuthMode);
    const whitelistMode = Boolean(data?.whitelistMode);
    const whitelist = Array.isArray(data?.whitelist) ? data.whitelist.filter((v) => typeof v === 'string') : [];
    const enableUserAccounts = Boolean(data?.enableUserAccounts);
    const perUserBasicAuth = Boolean(data?.perUserBasicAuth);
    const enableDiscreetLogin = Boolean(data?.enableDiscreetLogin);

    return {
        basicAuthMode,
        whitelistMode,
        whitelist,
        enableUserAccounts,
        perUserBasicAuth,
        enableDiscreetLogin,
    };
}

export async function loadConfig(): Promise<LoadedConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = (async () => {
        const env = loadEnvConfig();
        const mainPath = env.BARKEEPER_CONFIG_PATH
            ? path.resolve(env.BARKEEPER_CONFIG_PATH)
            : path.resolve(getPluginRoot(), 'data', 'config', 'main_conf.json');
        const main = await readJsonFile<MainConfig>(mainPath);
        const sillytavern = await loadSillyTavernConfig(main.sys_conf.main_conf.sillytavern_conf_path);
        const loaded: LoadedConfig = { main, env, sillytavern };
        cachedConfig = loaded;
        return loaded;
    })();

    return loadPromise;
}

export function getConfig(): LoadedConfig {
    if (!cachedConfig) {
        throw new Error('Config not loaded. Call loadConfig() during initialization.');
    }
    return cachedConfig;
}
