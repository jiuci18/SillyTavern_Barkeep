//! Resource type parsing and database representation conversion.

import type { MappingFileType, ResourceType, StoredFileType } from '../../types/resource';

const RESOURCE_TYPES = new Set<ResourceType>(['characters', 'worlds', 'presets', 'chats']);

/** Parse and validate a public resource type path segment or request field. */
export function parseResourceType(value: unknown): ResourceType | null {
    if (typeof value !== 'string') {
        return null;
    }

    return RESOURCE_TYPES.has(value as ResourceType) ? (value as ResourceType) : null;
}

/** Convert a public resource type into the existing file_mapping.file_type value. */
export function toStoredFileType(fileType: ResourceType): StoredFileType {
    switch (fileType) {
        case 'characters':
            return 'characters';
        case 'worlds':
            return 'worldinfo';
        case 'presets':
            return 'presets';
        case 'chats':
            return 'chat';
    }
}

/** Convert a file_mapping.file_type value into the public resource type. */
export function fromStoredFileType(fileType: string): MappingFileType {
    switch (fileType) {
        case 'unknown':
            return 'unknown';
        case 'characters':
            return 'characters';
        case 'worldinfo':
            return 'worlds';
        case 'presets':
            return 'presets';
        case 'chat':
            return 'chats';
        default:
            throw new Error(`Invalid stored file type: ${fileType}`);
    }
}
