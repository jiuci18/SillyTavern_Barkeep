# Manually Connecting Through the SillyTavern API Router

This guide connects a browser application to Barkeep through SillyTavern. Multi-user mode is optional. In multi-user mode the request sequence is HTTP Basic Authentication, session cookie creation, CSRF token acquisition, SillyTavern user login, and finally the Barkeep API request. In single-user mode, omit the user login step and use `default-user`.

## Configuration

Use SillyTavern router mode in `plugins/SillyTavern_Barkeep/.env`:

```dotenv
HTTP_MODE=false
API_PASSWORD_ENABLE=false
```

Enable the server, user accounts, CSRF protection, and CORS in the SillyTavern `config.yaml`. Replace the example origin with the exact protocol, host, and port of the browser application. Do not include a trailing slash.

```yaml
listen: true
port: 10242

basicAuthMode: true
basicAuthUser:
  username: http-user
  password: change-this-password

# Optional: true enables SillyTavern account login; false uses default-user.
enableUserAccounts: true
perUserBasicAuth: false
disableCsrfProtection: false

cors:
  enabled: true
  origin:
    - http://127.0.0.1:5501
  methods:
    - OPTIONS
    - GET
    - POST
    - PUT
    - DELETE
  allowedHeaders:
    - Content-Type
    - Authorization
    - X-CSRF-Token
  exposedHeaders: []
  credentials: true
  maxAge: 600
```

Add the same browser origin to `plugins/SillyTavern_Barkeep/data/config/main_conf.json`:

```json
{
  "sys_conf": {
    "safe_conf": {
      "cors_allow_hostlist": [
        "http://127.0.0.1:5501"
      ]
    },
    "main_conf": {
      "database": "data/data.db"
    }
  }
}
```

Restart SillyTavern after changing either configuration file. Never combine `cors.credentials: true` with the wildcard origin `*`.

SillyTavern uses an `HttpOnly` session cookie, so browser JavaScript cannot and should not read the cookie value. Calling `/csrf-token` with `credentials: "include"` makes the browser accept the `Set-Cookie` response automatically. Requests from a genuinely different site may be blocked by the cookie's `SameSite=Lax` policy; use the same site or place both applications behind one reverse proxy in that case.

## Browser connection

The following example is for `enableUserAccounts: true`. It keeps Basic credentials in memory, asks the browser to retain cookies, logs in to one SillyTavern account, and calls the Barkeep status endpoint:

```js
const sillyTavernBaseUrl = 'http://127.0.0.1:10242';
const basicUsername = 'http-user';
const basicPassword = 'change-this-password';
const userHandle = 'clause-ni';
const userPassword = 'account-password';

const basicAuthorization = `Basic ${btoa(`${basicUsername}:${basicPassword}`)}`;

async function readJson(response) {
    if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
    }

    return response.json();
}

const csrf = await readJson(await fetch(`${sillyTavernBaseUrl}/csrf-token`, {
    method: 'GET',
    credentials: 'include',
    headers: {
        Authorization: basicAuthorization,
    },
}));

await readJson(await fetch(`${sillyTavernBaseUrl}/api/users/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
        Authorization: basicAuthorization,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf.token,
    },
    body: JSON.stringify({
        handle: userHandle,
        password: userPassword,
    }),
}));

const status = await readJson(await fetch(
    `${sillyTavernBaseUrl}/api/plugins/barkeep/v1/${encodeURIComponent(userHandle)}/status/list`,
    {
        method: 'GET',
        credentials: 'include',
        headers: {
            Authorization: basicAuthorization,
        },
    },
));

console.log(status);
```

Every request must use `credentials: "include"` and must send HTTP Basic credentials while `basicAuthMode` is enabled. Send `X-CSRF-Token` on `POST`, `PUT`, and `DELETE` requests. The `{user}` value in the Barkeep URL must equal the handle stored in the authenticated SillyTavern session.

For `enableUserAccounts: false`, keep the `/csrf-token` request, remove the `/api/users/login` request, set `userHandle` to `default-user`, and call Barkeep directly. SillyTavern creates the single-user request context automatically.

For example, a Barkeep write request uses the same cookie, Basic header, and CSRF token:

```js
const response = await fetch(
    `${sillyTavernBaseUrl}/api/plugins/barkeep/v1/${encodeURIComponent(userHandle)}/src`,
    {
        method: 'PUT',
        credentials: 'include',
        headers: {
            Authorization: basicAuthorization,
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf.token,
        },
        body: JSON.stringify({
            type: 'characters',
            path: 'characters/example.png',
        }),
    },
);
```

An `OPTIONS` failure indicates an incorrect CORS origin, method, or allowed header. A `401` response usually indicates invalid Basic credentials. A `403` response usually indicates a missing SillyTavern session, an invalid CSRF token, or a `{user}` value that does not match the logged-in user. Check the browser network panel to confirm that `/csrf-token` returned `Set-Cookie` and later requests include a `Cookie` request header.
