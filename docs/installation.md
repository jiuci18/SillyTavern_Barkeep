# Barkeep — Installation Guide

## Prerequisites

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) (latest stable release)
- [Node.js](https://nodejs.org/) 22 or later
- [pnpm](https://pnpm.io/) (package manager)

## 1. Place the Plugin

Clone or copy the plugin into SillyTavern's `plugins/` directory so the folder structure matches:

```
SillyTavern/
├── plugins/
│   └── SillyTavern_Barkeep/    ← this plugin
│       ├── src/
│       ├── package.json
│       ├── webpack.config.js
│       ├── .env.example
│       ├── data/
│       │   └── config/
│       │       └── main_conf.json
│       └── ...
```

```bash
cd SillyTavern/plugins
git clone <repo-url> SillyTavern_Barkeep
```

If SillyTavern's `config.yaml` has `enableServerPlugins: false`, set it to `true`.

## 2. Install Dependencies

```bash
cd SillyTavern/plugins/SillyTavern_Barkeep
pnpm install
```

The `better-sqlite3` native addon will be built automatically (the workspace config allows builds).

## 3. Configure the `.env` File

Copy the example and edit:

```bash
cp .env.example .env
```

Minimal required settings:

```dotenv
# Path to the main config JSON (relative to plugin root)
BARKEEPER_CONFIG_PATH=data/config/main_conf.json

# SillyTavern root override — leave empty for auto-detection
SILLYTAVERN_ROOT=

# true = standalone HTTP server; false = embedded in SillyTavern's router
HTTP_MODE=false
```

**If `HTTP_MODE=true` (standalone):**

```dotenv
HTTP_MODE=true
BARKEEPER_LISTEN=127.0.0.1:10024

# Generate a strong random secret (64+ chars)
JWT_SECRET=<your-random-secret>

# Optional API password for single-user mode
API_PASSWORD_ENABLE=false
API_PASSWORD=
```

Without a persistent `JWT_SECRET`, tokens become invalid on every restart.

## 4. Review `data/config/main_conf.json`

```json
{
    "sys_conf": {
        "safe_conf": {
            "cors_allow_hostlist": [
                "http://localhost:10024",
                "http://localhost:5173"
            ]
        },
        "main_conf": {
            "database": "data/data.db"
        }
    }
}
```

- **`database`** — path to the SQLite database file (relative to plugin root). Created automatically on first run.
- **`cors_allow_hostlist`** — origins allowed to call this API from a browser. Add every origin that needs access. This field is required even in SillyTavern router mode because CORS preflight (`OPTIONS`) is handled by Barkeep.

## 5. Build the Plugin

```bash
pnpm build
```

This produces `dist/plugin.js` and copies the `better-sqlite3` runtime, including
its native addon, into `dist/node_modules`. SillyTavern loads `dist/plugin.js`
without needing to resolve SQLite from the repository-level `node_modules`.

The native addon is specific to the build machine's operating system, CPU
architecture, and Node.js ABI. Build release artifacts separately for every
supported target; a Linux x64 build cannot be reused on Windows or macOS.

For development, use:

```bash
pnpm build:dev
```

## 6. Start SillyTavern

```bash
cd SillyTavern
node server.js
```

You should see in the console:

```
[Sillytavern_Barkeeper] Detected SillyTavern root: /path/to/SillyTavern
[Sillytavern_Barkeeper] [DB]Executed migration: 001_Create_file_mapping.sql
[Sillytavern_Barkeeper] [Main]Plugin loaded! (SillyTavern router mode)
```

In standalone mode the log will show the HTTP server address instead.

## 7. Verify

**SillyTavern router mode (`HTTP_MODE=false`):**

```bash
curl http://127.0.0.1:8000/api/plugins/barkeep/v1/default-user/status/list
```

**Standalone mode (`HTTP_MODE=true`):**

```bash
curl http://127.0.0.1:10024/v1/default-user/status/list
```

## Connection Configuration

For details on authentication, CSRF, browser CORS setup, and `curl`/`fetch` examples, see:

- [Connecting to the Barkeep API](connecting.md) — base URLs, auth flows, curl examples
- [SillyTavern Router Connection](sillytavern-router.md) — browser `fetch` with cookies, CSRF, and Basic Auth

## Upgrading

```bash
cd SillyTavern/plugins/SillyTavern_Barkeep
git pull
pnpm install
pnpm build
```

Database migrations run automatically on startup. The `data/` directory (containing `data.db` and config) is gitignored — your data persists across upgrades.
