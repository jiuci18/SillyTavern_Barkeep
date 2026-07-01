# Sillytavern_Barkeeper

SillyTavern Barkeep maps characters, lorebooks, presets, chats, and other SillyTavern resources to a stable HTTP API, allowing external applications to manage them through persistent UUIDs with user isolation, file synchronization, optional authentication, and support for both embedded and standalone server modes.

> [!WARNING]
> This is a SillyTavern server plugin. Make sure you understand what you're doing before installing it!
>
> Back up your personal data before using this software.

## Configuration

Copy `.env.example` to `.env`. On startup, the plugin checks `../..` from its directory and then walks upward to find a SillyTavern installation. A valid root contains `package.json` with the name `sillytavern`, `server.js`, and `config.yaml`.

Set `SILLYTAVERN_ROOT` when running the plugin outside the standard `SillyTavern/plugins/<plugin>` layout. Relative paths in `BARKEEPER_CONFIG_PATH`, `SILLYTAVERN_ROOT`, and `main_conf.database` are resolved from the plugin directory.

The main configuration no longer accepts `sillytavern_conf_path`; the SillyTavern configuration is always read from `<SILLYTAVERN_ROOT>/config.yaml`.

Example `data/config/main_conf.json`:

```json
{
    "sys_conf": {
        "safe_conf": {
            "cors_allow_hostlist": []
        },
        "main_conf": {
            "database": "data/data.db"
        }
    }
}
```

## Registered resources

List every database-registered resource for one effective SillyTavern user:

```http
GET /v1/{user}/src
Authorization: Bearer <token>
```

The response includes mappings in stable creation order, including resources whose status is `normal`, `pending`, `not-found`, or `unresolved`:

```json
{
    "user": "default-user",
    "count": 1,
    "resources": [
        {
            "uuid": "8aacd248-b614-4273-b642-f92839ae1e90",
            "user": "default-user",
            "fileType": "characters",
            "filePath": "characters/example.png",
            "fileSize": 1024,
            "fileHash": "sha256",
            "status": "normal",
            "createdAt": 1751328000,
            "updatedAt": 1751328000
        }
    ]
}
```
