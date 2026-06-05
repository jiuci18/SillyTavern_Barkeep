import type { PresetCategoryDefinition } from '../types/status';

export const PRESET_CATEGORIES: readonly PresetCategoryDefinition[] = [
    { responseKey: 'openai', directoryName: 'OpenAI Settings', stripSuffixes: ['.json'] },
    { responseKey: 'textgen', directoryName: 'TextGen Settings', stripSuffixes: ['.json'] },
    { responseKey: 'koboldai', directoryName: 'KoboldAI Settings', stripSuffixes: ['.json'] },
    { responseKey: 'novelai', directoryName: 'NovelAI Settings', stripSuffixes: ['.json'] },
    { responseKey: 'instruct', directoryName: 'instruct', stripSuffixes: ['.json'] },
    { responseKey: 'context', directoryName: 'context', stripSuffixes: ['.json'] },
    { responseKey: 'sysprompt', directoryName: 'sysprompt', stripSuffixes: ['.json'] },
    { responseKey: 'quickReplies', directoryName: 'QuickReplies', stripSuffixes: ['.json'] },
] as const;

export const PRESET_DIRECTORY_NAMES: readonly string[] =
    PRESET_CATEGORIES.map((category) => category.directoryName);

export const PRESET_DIRECTORIES: ReadonlySet<string> = new Set(PRESET_DIRECTORY_NAMES);
