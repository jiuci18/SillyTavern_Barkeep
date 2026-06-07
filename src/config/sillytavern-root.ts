//! SillyTavern installation discovery and validation.

import fs from 'fs/promises';
import path from 'path';

interface PackageManifest {
    name?: unknown;
}

async function isSillyTavernRoot(candidate: string): Promise<boolean> {
    try {
        const [packageJson] = await Promise.all([
            fs.readFile(path.join(candidate, 'package.json'), 'utf8'),
            fs.access(path.join(candidate, 'server.js')),
            fs.access(path.join(candidate, 'config.yaml')),
        ]);
        const manifest = JSON.parse(packageJson) as PackageManifest;
        return manifest.name === 'sillytavern';
    } catch {
        return false;
    }
}

function listCandidates(pluginRoot: string): string[] {
    const candidates: string[] = [];
    let current = path.resolve(pluginRoot, '..', '..');

    while (true) {
        candidates.push(current);
        const parent = path.dirname(current);
        if (parent === current) {
            return candidates;
        }
        current = parent;
    }
}

/** Locate and validate the SillyTavern installation containing this plugin. */
export async function findSillyTavernRoot(
    pluginRoot: string,
    explicitRoot?: string,
): Promise<string> {
    if (explicitRoot?.trim()) {
        const candidate = path.resolve(pluginRoot, explicitRoot);
        if (await isSillyTavernRoot(candidate)) {
            return candidate;
        }

        throw new Error(
            `Configured SILLYTAVERN_ROOT is not a valid SillyTavern root: ${candidate}`,
        );
    }

    const candidates = listCandidates(pluginRoot);
    for (const candidate of candidates) {
        if (await isSillyTavernRoot(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        'You may be running outside a SillyTavern environment. '
        + 'Set SILLYTAVERN_ROOT explicitly. '
        + `Checked: ${candidates.join(', ')}`,
    );
}
