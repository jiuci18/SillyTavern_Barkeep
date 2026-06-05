import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import yaml from 'yaml';
import { EnvConfig, LoadedConfig, MainConfig, SillyTavernConfig } from '../types/config';

export { PRESET_CATEGORIES, PRESET_DIRECTORY_NAMES, PRESET_DIRECTORIES } from './constants';

let cachedConfig: LoadedConfig | null = null;
let loadPromise: Promise<LoadedConfig> | null = null;

export function getPluginRoot(): string {
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

    const normalized = value.toLowerCase();
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
        API_PASSWORD_ENABLE: parseBooleanEnv(process.env.API_PASSWORD_ENABLE, false),
        BARKEEPER_CONFIG_PATH: process.env.BARKEEPER_CONFIG_PATH,
        BARKEEPER_LISTEN: process.env.BARKEEPER_LISTEN,
        HTTP_MODE: parseBooleanEnv(process.env.HTTP_MODE, false),
        JWT_SECRET: process.env.JWT_SECRET,
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
    const configPath = path.resolve(confPath);
    const configDir = path.dirname(configPath);
    const dataRootValue = typeof data?.dataRoot === 'string' && data.dataRoot.trim().length > 0 ? data.dataRoot : './data';
    const basicAuthMode = Boolean(data?.basicAuthMode);
    const whitelistMode = Boolean(data?.whitelistMode);
    const whitelist = Array.isArray(data?.whitelist) ? data.whitelist.filter((v) => typeof v === 'string') : [];
    const enableUserAccounts = Boolean(data?.enableUserAccounts);
    const perUserBasicAuth = Boolean(data?.perUserBasicAuth);
    const enableDiscreetLogin = Boolean(data?.enableDiscreetLogin);

    return {
        configPath,
        dataRoot: path.resolve(configDir, dataRootValue),
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
        if (!env.BARKEEPER_CONFIG_PATH) {
            throw new Error('BARKEEPER_CONFIG_PATH is required. Please set it in the plugin .env file.');
        }

        const mainPath = path.resolve(env.BARKEEPER_CONFIG_PATH);
        const main = await readJsonFile<MainConfig>(mainPath);
        const sillytavern = await loadSillyTavernConfig(main.sys_conf.main_conf.sillytavern_conf_path);
        const loaded: LoadedConfig = { main, env, sillytavern };
        cachedConfig = loaded;
        return loaded;
    })().catch((error) => {
        loadPromise = null;
        cachedConfig = null;
        throw error;
    });

    return loadPromise;
}

export function getConfig(): LoadedConfig {
    if (!cachedConfig) {
        throw new Error('Config not loaded. Call loadConfig() during initialization.');
    }
    return cachedConfig;
}
