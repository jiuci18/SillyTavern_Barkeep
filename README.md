# Sillytavern_Barkeeper
Let us be your SillyTavern barkeep!

> [!WARNING]
> This is a SillyTavern server plugin. Make sure you understand what you're doing before installing it!
>
> Back up your personal data before using this software.

## Configuration

Copy `.env.example` to `.env`. On startup, the plugin checks `../..` from its
directory and then walks upward to find a SillyTavern installation. A valid
root contains `package.json` with the name `sillytavern`, `server.js`, and
`config.yaml`.

Set `SILLYTAVERN_ROOT` when running the plugin outside the standard
`SillyTavern/plugins/<plugin>` layout. Relative paths in
`BARKEEPER_CONFIG_PATH`, `SILLYTAVERN_ROOT`, and `main_conf.database` are
resolved from the plugin directory.

The main configuration no longer accepts `sillytavern_conf_path`; the
SillyTavern configuration is always read from `<SILLYTAVERN_ROOT>/config.yaml`.

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
