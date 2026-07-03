# Connecting to the Barkeep API

Barkeep has two connection modes, and SillyTavern multi-user mode is optional in both. Barkeep reads `enableUserAccounts` from the active SillyTavern `config.yaml` at startup. Set `HTTP_MODE` in the plugin `.env` file and restart SillyTavern after changing either mode.

## SillyTavern mode

This is the recommended mode when Barkeep should use SillyTavern's HTTP Basic Authentication, user session, and CSRF protection.

```dotenv
HTTP_MODE=false
API_PASSWORD_ENABLE=false
API_PASSWORD_FORCE=false
```

The base URL is:

```text
http://<host>:<sillytavern-port>/api/plugins/barkeep
```

With `enableUserAccounts: true`, the client must obtain a CSRF token, log in to SillyTavern, retain the session cookie, and then call Barkeep with the logged-in handle. With `enableUserAccounts: false`, skip `/api/users/login`; SillyTavern automatically uses `default-user`. Basic credentials must be sent on every request when `basicAuthMode` is enabled.

For browser CORS configuration and a complete `fetch` example, see [Manually connecting through the SillyTavern API router](sillytavern-router.md).

```sh
export ST_BASE='http://127.0.0.1:10242'
export ST_BASIC_USER='http-user'
export ST_BASIC_PASSWORD='http-password'
export ST_USER_HANDLE='clause-ni'
export ST_USER_PASSWORD='account-password'

CSRF_TOKEN="$(
  curl -fsS \
    --user "$ST_BASIC_USER:$ST_BASIC_PASSWORD" \
    --cookie-jar cookies.txt \
    --cookie cookies.txt \
    "$ST_BASE/csrf-token" |
  node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token'
)"

curl --fail-with-body \
  --user "$ST_BASIC_USER:$ST_BASIC_PASSWORD" \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  --header "X-CSRF-Token: $CSRF_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "$(node -e 'process.stdout.write(JSON.stringify({
    handle: process.env.ST_USER_HANDLE,
    password: process.env.ST_USER_PASSWORD
  }))')" \
  "$ST_BASE/api/users/login"

curl --fail-with-body \
  --user "$ST_BASIC_USER:$ST_BASIC_PASSWORD" \
  --cookie cookies.txt \
  "$ST_BASE/api/plugins/barkeep/v1/$ST_USER_HANDLE/status/list"
```

Send the same cookie and `X-CSRF-Token` on Barkeep `POST`, `PUT`, and `DELETE` requests. Do not call Barkeep's `/v1/login` in this mode unless `API_PASSWORD_FORCE` is enabled. In multi-user mode, `{user}` must match the logged-in handle; in single-user mode, use `default-user`.

### Enhanced Security in SillyTavern Mode

If you want to expose Barkeep through the main SillyTavern port but strictly require API password authentication for all Barkeep requests (ignoring ST's default "no auth" behavior in single-user mode), enable `API_PASSWORD_FORCE`:

```dotenv
HTTP_MODE=false
API_PASSWORD_FORCE=true
API_PASSWORD=<strong-password>
```

When forced, all requests to Barkeep endpoints must include an `Authorization: Bearer <token>` header, and you must call `/v1/login` with your API password to obtain this token, exactly as in Standalone HTTP mode.

## Standalone HTTP mode

This mode exposes Barkeep on a separate listener. SillyTavern's Basic Authentication, session, and CSRF middleware do not protect it.

```dotenv
HTTP_MODE=true
BARKEEPER_LISTEN=127.0.0.1:10024
JWT_SECRET=<persistent-random-secret-of-at-least-64-characters>
```

When SillyTavern has `enableUserAccounts: true`, exchange a local SillyTavern user password for a user-scoped Bearer token:

```sh
export BARKEEP_BASE='http://127.0.0.1:10024'
export ST_USER_HANDLE='clause-ni'
export ST_USER_PASSWORD='account-password'

TOKEN="$(
  curl -fsS \
    --header 'Content-Type: application/json' \
    --data "$(node -e 'process.stdout.write(JSON.stringify({
      handle: process.env.ST_USER_HANDLE,
      password: process.env.ST_USER_PASSWORD
    }))')" \
    "$BARKEEP_BASE/v1/login" |
  node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token'
)"

curl --fail-with-body \
  --header "Authorization: Bearer $TOKEN" \
  "$BARKEEP_BASE/v1/$ST_USER_HANDLE/status/list"
```

Barkeep verifies the password against the local SillyTavern account record, rate-limits failed logins, and restricts the token to that user.

For single-user SillyTavern, configure `API_PASSWORD_ENABLE=true` and `API_PASSWORD=<strong-password>`, then call `/v1/login` with:

```json
{ "password": "strong-password" }
```

Never expose standalone mode without user authentication or an API password. Browser clients must add their exact origin to `sys_conf.safe_conf.cors_allow_hostlist` in `data/config/main_conf.json`.

## Routes

In SillyTavern mode, prefix every path with `/api/plugins/barkeep`. In standalone mode, use each path directly.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/login` | Obtain a standalone Bearer token |
| `GET` | `/v1/{user}/status/list` | List available resources |
| `GET` | `/v1/{user}/src` | List registered mappings |
| `POST` | `/v1/{user}/src` | Inspect a mapping |
| `PUT` | `/v1/{user}/src` | Register a mapping |
| `GET` | `/v1/{user}/{resource}/{uuid}` | Download a resource |
| `POST` | `/v1/{user}/{resource}/{uuid}` | Upload resource content |
| `DELETE` | `/v1/{user}/{resource}/{uuid}` | Delete a resource |

`401` means authentication failed, `403` means cross-user access or CSRF validation failed, and `429` means too many login attempts. If `JWT_SECRET` is empty, standalone tokens become invalid whenever Barkeep restarts.
