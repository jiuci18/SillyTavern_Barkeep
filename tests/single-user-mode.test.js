const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

let root;
let config;
let resolveUserDirectory;

test.before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-single-user-'));
    const sillyTavernRoot = path.join(root, 'SillyTavern');
    const dataRoot = path.join(sillyTavernRoot, 'data');
    const configPath = path.join(root, 'main.json');

    await fs.mkdir(dataRoot, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(sillyTavernRoot, 'package.json'), '{"name":"sillytavern"}'),
        fs.writeFile(path.join(sillyTavernRoot, 'server.js'), ''),
        fs.writeFile(
            path.join(sillyTavernRoot, 'config.yaml'),
            `dataRoot: ${JSON.stringify(dataRoot)}\nenableUserAccounts: false\n`,
        ),
        fs.writeFile(
            configPath,
            JSON.stringify({
                sys_conf: {
                    safe_conf: { cors_allow_hostlist: [] },
                    main_conf: { database: path.join(root, 'data.db') },
                },
            }),
        ),
    ]);

    process.env.BARKEEPER_CONFIG_PATH = configPath;
    process.env.SILLYTAVERN_ROOT = sillyTavernRoot;
    process.env.HTTP_MODE = 'false';

    const configModule = require('../out/config/config');
    config = await configModule.loadConfig();
    ({ resolveUserDirectory } = require('../out/service/resource/path'));
});

test.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
});

test('detects_single_user_mode', () => {
    assert.equal(config.sillytavern.enableUserAccounts, false);
});

test('uses_default_user_in_single_user_mode', () => {
    const resolved = resolveUserDirectory('ignored-user');

    assert.equal(resolved.safeUser, 'default-user');
    assert.equal(resolved.userDirectory, path.join(config.sillytavern.dataRoot, 'default-user'));
});
