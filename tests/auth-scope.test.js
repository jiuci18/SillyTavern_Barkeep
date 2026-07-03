const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { authorizeRouteUser } = require('../out/middleware/auth');
const { consumeLoginAttempt } = require('../out/service/auth/login-rate-limit');
const { verifySillyTavernAccount } = require('../out/service/auth/sillytavern-account');

async function writeAccount(dataRoot, account) {
    const key = `user:${account.handle}`;
    const fileName = crypto.createHash('sha256').update(key).digest('hex');
    const storageDirectory = path.join(dataRoot, '_storage');
    await fs.mkdir(storageDirectory, { recursive: true });
    await fs.writeFile(
        path.join(storageDirectory, fileName),
        JSON.stringify({ key, value: account }),
    );
}

test('allows_matching_session_user', () => {
    const result = authorizeRouteUser(
        { user: 'alice' },
        { kind: 'user', handle: 'alice' },
    );

    assert.equal(result, null);
});

test('rejects_cross_user_session', () => {
    const result = authorizeRouteUser(
        { user: 'bob' },
        { kind: 'user', handle: 'alice' },
    );

    assert.equal(result.statusCode, 403);
});

test('allows_standalone_server_scope', () => {
    const result = authorizeRouteUser(
        { user: 'bob' },
        { kind: 'server' },
    );

    assert.equal(result, null);
});

test('limits_repeated_login_attempts', () => {
    const address = 'test-client';
    const now = 1_000;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.equal(consumeLoginAttempt(address, now), null);
    }

    assert.equal(consumeLoginAttempt(address, now), 60);
});

test('rejects_missing_embedded_principal', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-embedded-auth-'));
    const sillyTavernRoot = path.join(root, 'SillyTavern');
    const configPath = path.join(root, 'main.json');

    try {
        await fs.mkdir(sillyTavernRoot, { recursive: true });
        await Promise.all([
            fs.writeFile(path.join(sillyTavernRoot, 'package.json'), '{"name":"sillytavern"}'),
            fs.writeFile(path.join(sillyTavernRoot, 'server.js'), ''),
            fs.writeFile(
                path.join(sillyTavernRoot, 'config.yaml'),
                `dataRoot: ${JSON.stringify(path.join(sillyTavernRoot, 'data'))}\nenableUserAccounts: true\n`,
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

        const { loadConfig } = require('../out/config/config');
        await loadConfig();
        const { authorizeApiRequest } = require('../out/middleware/auth');
        const result = authorizeApiRequest({
            method: 'GET',
            path: '/v1/{user}/src',
            handler: () => ({ statusCode: 200 }),
        }, undefined);

        assert.equal(result.rejection.statusCode, 401);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('accepts_valid_local_account_password', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-account-'));
    const salt = crypto.randomBytes(16).toString('base64');
    const password = 'correct horse battery staple';
    const passwordHash = crypto.scryptSync(password.normalize(), salt, 64).toString('base64');

    try {
        await writeAccount(dataRoot, {
            handle: 'alice',
            password: passwordHash,
            salt,
            enabled: true,
        });

        const accepted = await verifySillyTavernAccount(dataRoot, 'alice', password);

        assert.equal(accepted, true);
    } finally {
        await fs.rm(dataRoot, { recursive: true, force: true });
    }
});

test('rejects_invalid_local_account_password', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-account-'));
    const salt = crypto.randomBytes(16).toString('base64');
    const passwordHash = crypto.scryptSync('expected', salt, 64).toString('base64');

    try {
        await writeAccount(dataRoot, {
            handle: 'alice',
            password: passwordHash,
            salt,
            enabled: true,
        });

        const accepted = await verifySillyTavernAccount(dataRoot, 'alice', 'unexpected');

        assert.equal(accepted, false);
    } finally {
        await fs.rm(dataRoot, { recursive: true, force: true });
    }
});

test('rejects_disabled_local_account', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'barkeep-account-'));
    const salt = crypto.randomBytes(16).toString('base64');
    const password = 'password';
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('base64');

    try {
        await writeAccount(dataRoot, {
            handle: 'alice',
            password: passwordHash,
            salt,
            enabled: false,
        });

        const accepted = await verifySillyTavernAccount(dataRoot, 'alice', password);

        assert.equal(accepted, false);
    } finally {
        await fs.rm(dataRoot, { recursive: true, force: true });
    }
});
