import fs from 'fs/promises';
import path from 'path';
import { getConfig, PRESET_CATEGORIES } from '../config/config';
import type { ApiRouteContext, ApiRouteResult } from '../types/api';
import type {
    AssetListItem,
    CharacterChatGroup,
    UserStatusListPresets,
    UserStatusListResponse,
} from '../types/status';
import { ErrorCode, createNotFoundError } from '../utils/errors';
import { listFilesInDirectory, pathExists, sortAssetItems } from '../utils/files';
import { assertSafeUserHandle } from '../utils/user';

const CHARACTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const CHAT_EXTENSION = '.jsonl';
const DEFAULT_SINGLE_USER_HANDLE = 'default-user';

function resolveEffectiveUserHandle(user: string): string {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    if (!config.sillytavern.enableUserAccounts) {
        return DEFAULT_SINGLE_USER_HANDLE;
    }

    return assertSafeUserHandle(user);
}

function buildUserDirectoryPath(user: string): string {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    return path.join(config.sillytavern.dataRoot, resolveEffectiveUserHandle(user));
}

function stripChatFileSuffix(fileName: string): string {
    if (fileName.toLowerCase().endsWith(CHAT_EXTENSION)) {
        return fileName.slice(0, -CHAT_EXTENSION.length);
    }

    return path.parse(fileName).name;
}

async function listCharacterChatGroups(userDirectory: string, characters: AssetListItem[]): Promise<CharacterChatGroup[]> {
    const chatsRoot = path.join(userDirectory, 'chats');
    if (!(await pathExists(chatsRoot))) {
        return [];
    }

    const characterByName = new Map(characters.map((character) => [character.name.toLowerCase(), character]));
    const dirEntries = await fs.readdir(chatsRoot, { withFileTypes: true });

    const groups = await Promise.all(
        dirEntries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map(async (entry) => {
                const chats = await listFilesInDirectory(path.join(chatsRoot, entry.name), {
                    stripSuffixes: [CHAT_EXTENSION],
                    allowedExtensions: new Set([CHAT_EXTENSION]),
                });

                if (chats.length === 0) {
                    return null;
                }

                const matchedCharacter = characterByName.get(entry.name.toLowerCase());
                const character: AssetListItem = matchedCharacter ?? {
                    name: entry.name,
                    file: entry.name,
                    extension: '',
                    size: 0,
                    updatedAt: chats[0]?.updatedAt ?? new Date(0).toISOString(),
                };

                return {
                    character,
                    chats: chats.map((chat) => ({
                        ...chat,
                        name: stripChatFileSuffix(chat.file),
                    })),
                };
            }),
    );

    return groups
        .filter((group): group is CharacterChatGroup => group !== null)
        .sort((left, right) => left.character.file.localeCompare(right.character.file, undefined, { numeric: true, sensitivity: 'base' }));
}

async function getUserStatusList(user: string): Promise<UserStatusListResponse> {
    const config = getConfig();
    if (!config.sillytavern) {
        throw new Error('SillyTavern config is not loaded.');
    }

    const safeUser = resolveEffectiveUserHandle(user);
    const userDirectory = buildUserDirectoryPath(safeUser);
    const userExists = await pathExists(userDirectory);

    if (!userExists) {
        throw createNotFoundError(ErrorCode.UserNotFound, `User "${safeUser}" not found.`);
    }

    const [characters, worlds, presetGroups, groupChats] = await Promise.all([
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
            })),
        ),
        listFilesInDirectory(path.join(userDirectory, 'group chats'), {
            stripSuffixes: [CHAT_EXTENSION],
            allowedExtensions: new Set([CHAT_EXTENSION]),
        }),
    ]);
    const characterChats = await listCharacterChatGroups(userDirectory, characters);

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
            })),
        ),
    );
    const totalCharacterChats = characterChats.reduce((sum, group) => sum + group.chats.length, 0);
    const normalizedGroupChats = groupChats.map((chat) => ({
        ...chat,
        name: stripChatFileSuffix(chat.file),
    }));

    return {
        user: safeUser,
        mode: config.sillytavern.enableUserAccounts ? 'multi-user' : 'single-user',
        characters,
        worlds,
        presets: {
            ...presetMap,
            all: allPresets,
        },
        chats: {
            characters: characterChats,
            groupChats: normalizedGroupChats,
        },
        counts: {
            characters: characters.length,
            worlds: worlds.length,
            presets: allPresets.length,
            characterChatGroups: characterChats.length,
            characterChats: totalCharacterChats,
            groupChats: normalizedGroupChats.length,
            chats: totalCharacterChats + normalizedGroupChats.length,
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
