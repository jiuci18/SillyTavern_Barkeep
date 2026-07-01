const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const FILE_MAPPING_SCHEMA = `
CREATE TABLE file_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    file_hash TEXT,
    user TEXT NOT NULL,
    file_type TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user, file_type, file_path)
)`;

async function createTestConfig(root) {
    const sillyTavernRoot = path.join(root, 'SillyTavern');
    const dataRoot = path.join(sillyTavernRoot, 'data');
    const configPath = path.join(root, 'main.json');
    const databasePath = path.join(root, 'data.db');

    await fs.mkdir(dataRoot, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(sillyTavernRoot, 'package.json'), '{"name":"sillytavern"}'),
        fs.writeFile(path.join(sillyTavernRoot, 'server.js'), ''),
        fs.writeFile(
            path.join(sillyTavernRoot, 'config.yaml'),
            `dataRoot: ${JSON.stringify(dataRoot)}\nenableUserAccounts: true\n`,
        ),
        fs.writeFile(
            configPath,
            JSON.stringify({
                sys_conf: {
                    safe_conf: { cors_allow_hostlist: [] },
                    main_conf: { database: databasePath },
                },
            }),
        ),
    ]);

    return { configPath, sillyTavernRoot };
}

test('lists_every_registered_resource_for_requested_user', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-source-list-'));

    try {
        const { configPath, sillyTavernRoot } = await createTestConfig(root);
        process.env.BARKEEPER_CONFIG_PATH = configPath;
        process.env.SILLYTAVERN_ROOT = sillyTavernRoot;

        const { loadConfig } = require('../out/config/config');
        const { closeDatabase, getDatabase } = require('../out/db/connection');
        const {
            createPendingMapping,
            upsertNormalMapping,
        } = require('../out/db/file-mapping');
        const { handleSourceList } = require('../out/handler/src');

        await loadConfig();
        getDatabase().exec(FILE_MAPPING_SCHEMA);

        const normal = upsertNormalMapping({
            user: 'alice',
            fileType: 'characters',
            filePath: 'characters/Alice.png',
            fileSize: 12,
            fileHash: 'hash',
        });
        const pending = createPendingMapping({
            user: 'alice',
            fileType: 'worlds',
            filePath: 'worlds/Future.json',
        });
        createPendingMapping({
            user: 'bob',
            fileType: 'presets',
            filePath: 'OpenAI Settings/Bob.json',
        });

        const result = handleSourceList({
            body: undefined,
            params: { user: 'alice' },
            path: '/v1/alice/src',
        });

        assert.equal(result.statusCode, 200);
        assert.equal(result.body.user, 'alice');
        assert.equal(result.body.count, 2);
        assert.deepEqual(
            result.body.resources.map((resource) => resource.uuid).sort(),
            [normal.uuid, pending.uuid].sort(),
        );
        assert.ok(result.body.resources.every((resource) => resource.user === 'alice'));
        closeDatabase();
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('routes_get_source_collection_to_list_handler', () => {
    const { matchApiRoute } = require('../out/cmd/api');

    const match = matchApiRoute('GET', '/v1/alice/src');

    assert.ok(match);
    assert.equal(match.route.path, '/v1/{user}/src');
    assert.deepEqual(match.params, { user: 'alice' });
});
