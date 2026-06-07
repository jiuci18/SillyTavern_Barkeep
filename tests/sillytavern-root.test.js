const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { findSillyTavernRoot } = require('../out/config/sillytavern-root');

async function createRoot(directory) {
    await fs.mkdir(directory, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(directory, 'package.json'), '{"name":"sillytavern"}'),
        fs.writeFile(path.join(directory, 'server.js'), ''),
        fs.writeFile(path.join(directory, 'config.yaml'), ''),
    ]);
}

async function withTempDirectory(run) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-root-'));
    try {
        await run(directory);
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
}

test('finds_standard_parent_root', async () => {
    await withTempDirectory(async (root) => {
        const pluginRoot = path.join(root, 'plugins', 'barkeep');
        await createRoot(root);
        await fs.mkdir(pluginRoot, { recursive: true });

        assert.equal(await findSillyTavernRoot(pluginRoot), root);
    });
});

test('walks_up_from_standard_candidate', async () => {
    await withTempDirectory(async (root) => {
        const sillyTavernRoot = path.join(root, 'SillyTavern');
        const pluginRoot = path.join(sillyTavernRoot, 'nested', 'plugins', 'barkeep');
        await createRoot(sillyTavernRoot);
        await fs.mkdir(pluginRoot, { recursive: true });

        assert.equal(await findSillyTavernRoot(pluginRoot), sillyTavernRoot);
    });
});

test('prefers_explicit_root', async () => {
    await withTempDirectory(async (root) => {
        const automaticRoot = path.join(root, 'automatic');
        const explicitRoot = path.join(root, 'explicit');
        const pluginRoot = path.join(automaticRoot, 'plugins', 'barkeep');
        await createRoot(automaticRoot);
        await createRoot(explicitRoot);
        await fs.mkdir(pluginRoot, { recursive: true });

        assert.equal(await findSillyTavernRoot(pluginRoot, explicitRoot), explicitRoot);
    });
});

test('rejects_invalid_explicit_root_without_fallback', async () => {
    await withTempDirectory(async (root) => {
        const pluginRoot = path.join(root, 'plugins', 'barkeep');
        await createRoot(root);
        await fs.mkdir(pluginRoot, { recursive: true });

        await assert.rejects(
            findSillyTavernRoot(pluginRoot, path.join(root, 'missing')),
            /Configured SILLYTAVERN_ROOT/,
        );
    });
});

test('reports_checked_paths_when_root_is_missing', async () => {
    await withTempDirectory(async (root) => {
        const pluginRoot = path.join(root, 'plugins', 'barkeep');
        await fs.mkdir(pluginRoot, { recursive: true });

        await assert.rejects(
            findSillyTavernRoot(pluginRoot),
            (error) => error.message.includes('Set SILLYTAVERN_ROOT explicitly')
                && error.message.includes(root),
        );
    });
});
