import path from 'path';
import { getConfig } from '../config/config';
import type { ApiRouteContext, ApiRouteResult } from '../types/api';
import type { AssetListItem, PresetCategoryDefinition, UserStatusListPresets, UserStatusListResponse } from '../types/status';
import { listFilesInDirectory, pathExists, sortAssetItems } from '../utils/files';
import { assertSafeUserHandle } from '../utils/user';

const CHARACTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const PRESET_CATEGORIES: readonly PresetCategoryDefinition[] = [
    { responseKey: 'openai', directoryName: 'OpenAI Settings', stripSuffixes: ['.json'] },
    { responseKey: 'textgen', directoryName: 'TextGen Settings', stripSuffixes: ['.json'] },
    { responseKey: 'koboldai', directoryName: 'KoboldAI Settings', stripSuffixes: ['.json'] },
    { responseKey: 'novelai', directoryName: 'NovelAI Settings', stripSuffixes: ['.json'] },
    { responseKey: 'instruct', directoryName: 'instruct', stripSuffixes: ['.json'] },
    { responseKey: 'context', directoryName: 'context', stripSuffixes: ['.json'] },
    { responseKey: 'sysprompt', directoryName: 'sysprompt', stripSuffixes: ['.json'] },
    { responseKey: 'quickReplies', directoryName: 'QuickReplies', stripSuffixes: ['.json'] },
] as const;

function buildUserDirectoryPath(user: string): string {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    return path.join(config.sillytavern.dataRoot, assertSafeUserHandle(user));
}

async function getUserStatusList(user: string): Promise<UserStatusListResponse> {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    const safeUser = assertSafeUserHandle(user);
    const userDirectory = buildUserDirectoryPath(safeUser);
    const userExists = await pathExists(userDirectory);

    if (!userExists) {
        const error = new Error(`User "${safeUser}" not found.`);
        (error as Error & { code?: string }).code = 'USER_NOT_FOUND';
        throw error;
    }

    const [characters, worlds, presetGroups] = await Promise.all([
        listFilesInDirectory(path.join(userDirectory, 'characters'), {
            allowedExtensions: CHARACTER_EXTENSIONS,
        }),
        listFilesInDirectory(path.join(userDirectory, 'worlds'), {
            stripSuffixes: ['.world.json', '.json'],
        }),
        Promise.all(
            PRESET_CATEGORIES.map(async (category) => ({
                key: category.responseKey,
                items: await listFilesInDirectory(path.join(userDirectory, category.directoryName), {
                    stripSuffixes: category.stripSuffixes,
                }),
            }))
        ),
    ]);

    const presetMap: Omit<UserStatusListPresets, 'all'> = {
        openai: [],
        textgen: [],
        koboldai: [],
        novelai: [],
        instruct: [],
        context: [],
        sysprompt: [],
        quickReplies: [],
    };

    for (const group of presetGroups) {
        presetMap[group.key as keyof Omit<UserStatusListPresets, 'all'>] = group.items;
    }

    const allPresets = sortAssetItems(
        presetGroups.flatMap((group) =>
            group.items.map((item) => ({
                ...item,
                category: group.key,
            }))
        )
    );

    return {
        user: safeUser,
        mode: config.sillytavern.enableUserAccounts ? 'multi-user' : 'single-user',
        characters,
        worlds,
        presets: {
            ...presetMap,
            all: allPresets,
        },
        counts: {
            characters: characters.length,
            worlds: worlds.length,
            presets: allPresets.length,
        },
    };
}

export async function handleUserStatusList({ params }: ApiRouteContext): Promise<ApiRouteResult> {
    console.log(`[Sillytavern_Barkeeper] Resource list requested for user: ${params.user}`);

    return {
        statusCode: 200,
        body: await getUserStatusList(params.user),
    };
}
