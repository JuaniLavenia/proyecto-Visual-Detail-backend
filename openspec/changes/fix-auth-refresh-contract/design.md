# Design: Fix Auth Response Contract

## Technical Approach

Two independent defects share one code path. Neither needs new abstractions — both are removals plus one wrapper call:

1. **Success shape**: `login`/`register` build a flat literal. Wrap the same object with the existing `success()` from `src/utils/response-formatter.js` and rename `token` → `accessToken` (the name `authService.generateTokens()` already returns).
2. **Error shape**: `auth.router.js` registers `errorMidleware` (4-arity) as the last handler of each of its 6 routes. Express's `Route.dispatch` resolves error handlers on the *route layer* before unwinding to the app stack, so the app-level `errorMiddleware` (`src/app.js:63`) is unreachable for auth. Removing the 6 references + the import restores propagation. No error-mapping code is written: `error.middleware.js` already maps `AppError.statusCode`/`.code`.

Layering is untouched (routes → controllers → services → models). No service, model, or config edit.

## Sequence: current vs. corrected error flow

```
CURRENT — POST /api/login, wrong password
  requestValidation → next()
  login (asyncHandler) → authService.login()
      throw AppError('El correo y/o la contraseña son incorrectos', 401, 'AUTH_INVALID')
  asyncHandler .catch(next) → next(err)
  Route.dispatch finds errorMidleware on the SAME route layer
      res.status(500).json({ message: "Internal server error" })   ✗ status + code lost
  app.js errorMiddleware ................................. NEVER REACHED

CORRECTED — same request
  requestValidation → next()
  login (asyncHandler) → authService.login() → throw AppError(..., 401, 'AUTH_INVALID')
  asyncHandler .catch(next) → next(err)
  route layer has no error handler → err unwinds to the app stack
  app.js:63 errorMiddleware
      401 { success:false, error:{ message:'El correo y/o…', code:'AUTH_INVALID' } }
      (+ error.stack only when config.env === 'development')
```

## Controller design (`src/controllers/auth.controller.js`)

```js
// import diff: remove line 7 — validationResult becomes unused after the 422 block goes
- const { validationResult } = require("express-validator");
  const authService = require("../services/auth.service");
  const { asyncHandler } = require("../middleware/error.middleware");
  const { success } = require("../utils/response-formatter");   // already imported

const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(success({
    userId: result.user._id,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    role: result.user.role,
    user: result.user,
  }, "Login exitoso"));
});

const register = asyncHandler(async (req, res, next) => {
  // the 422 validationResult block is deleted (unreachable: requestValidation runs first)
  const { email, password } = req.body;
  const result = await authService.register(email, password);
  res.status(201).json(success({ /* same 5 fields as login */ }, "Registro exitoso"));
});

const refresh = /* UNCHANGED */ res.json(success(tokens, "Token refrescado"));
const logout  = /* UNCHANGED */ res.json(success(null, "Logout exitoso"));
```

`refresh` already emits `{accessToken, refreshToken}` from `generateTokens()`; `logout` passes `null`, and `success()` omits `data` when null — matching the proposal's logout contract. `forgotPassword`/`resetPassword` and the `module.exports` block are untouched.

## Import diff after deleting `errorMidleware`

`src/middleware/common.middleware.js` — delete lines 10–14 and shrink the export:

```js
- module.exports = { requestValidation, errorMidleware };
+ module.exports = { requestValidation };
```

`src/routes/auth.router.js` — the destructured import collapses to one name, and 6 trailing arguments go:

```js
- const { errorMidleware, requestValidation } = require("../middleware/common.middleware");
+ const { requestValidation } = require("../middleware/common.middleware");
```

No other consumer exists (grep-verified): `users.js:10`, `productos.js:18`, `pedidos.js:15`, `cart.routes.js:9`, `favorites.routes.js:9` all destructure `requestValidation` only, so the narrowed export is source-compatible. `README.md:34` mentions the file, not the symbol.

`forgotPassword`/`resetPassword` are plain `async (req, res)` with internal try/catch — they never call `next(err)`, so `errorMidleware` was already unreachable for them. Removing it changes nothing on those two routes.

## Architecture decisions

| Decision | Choice | Rejected alternative | Rationale |
|---|---|---|---|
| Reach the app-level handler | Delete the route-level handler | Rewrite `errorMidleware` to re-emit the real status/envelope | Duplicates `error.middleware.js`; two handlers to keep in sync. |
| | | Keep it and register the app handler earlier | Express order is structural — route layers always win. Impossible. |
| Success envelope | `success()` on login/register | Hand-built `{success,data,message}` literal | The other 3 formatter-using controllers call `success()`; literals drift. |
| `message` for login/register | Concrete strings (`"Login exitoso"`) | `success(data)` with no message | Proposal's target contract shows `message`; `success()` omits it when null. Frontend ignores it. |
| Validation 400 shape | Leave `requestValidation`'s `{errors:[…]}` as-is | Convert it to `error()` envelope | Out of scope; would change all 6 routers' 400 shape. Recorded as known residual inconsistency. |
| Dead-code removal | Delete `errorMidleware` from `common.middleware.js` | Leave it unexported/deprecated | Proposal decision (approved) — a reachable export invites re-attaching the defect. |

## Application order (manual verification per step)

Server must be restarted between steps (`config.env === 'development'` to see stacks).

| # | Edit | Unlocks | Manual check (cases from `exploration.md`) |
|---|---|---|---|
| 1 | `auth.controller.js`: wrap + `accessToken` + drop 422 | success paths | Cases 1, 2, 4, 5. `POST /api/login` → `200 {success:true,data:{accessToken,…},message}`. `POST /api/register` → 201 same shape. `POST /api/refresh` → tokens defined, old refresh token now rejected. `POST /api/logout` → `{success:true,message}`. Errors still show the wrong 500 here — expected until step 2. |
| 2 | `auth.router.js`: drop `errorMidleware` (import + 6 routes) | error paths | Cases 3, 6, 7. Bad password → **401** `AUTH_INVALID`. Duplicate email → **409** `USER_EXISTS`. Garbage/expired refresh token → **401** `INVALID_TOKEN`/`TOKEN_EXPIRED`. Empty body → still 400 `{errors:[…]}` from `requestValidation`. `POST /api/forgot` with unknown email → still 422 `{error:"No existe el usuario"}` (unchanged). |
| 3 | `common.middleware.js`: delete dead middleware | — | Server boots with no `MODULE_NOT_FOUND`/undefined-handler error. `GET /api/productos?page=0` → 400 `{errors:[…]}` proves `requestValidation` still resolves from the narrowed export. Re-run case 6 to confirm no regression. |
| 4 | Append correction note to `sdd/mejorar-seguridad-arquitectura-backend/verify-report.md` | — | Diff shows additions only; lines 93/127/140 byte-identical. |

Step 2 is the only step that changes observable error status codes, so a revert of step 2 alone restores prior error behavior without touching the success contract.

## Testing strategy

| Layer | What | Approach |
|---|---|---|
| Unit / Integration / E2E | — | No test runner (`openspec/config.yaml: test_runner: none`). Not introduced by this change. |
| Manual (authoritative) | 7 cases in `exploration.md` | curl/Postman per the step table above; assert HTTP status **and** body shape. |
| Static | Import/export integrity | Grep `errorMidleware` → zero hits outside `openspec/`, `sdd/`; boot the server. |

## Threat matrix

N/A — no shell, subprocess, VCS/PR automation, or executable-file classification boundary. Per-row: documentation-like paths `N/A` (no file classification); git repository selection, commit state, push state, PR commands all `N/A` (no VCS automation in this change). The Express middleware-chain edit is HTTP-internal routing, not command/path routing; its adversarial cases are the invalid-token / invalid-credential / duplicate-email manual cases (3, 6, 7).

## Migration / rollout

No migration — stateless, no schema, token format, or persisted-data change. Ships in one deploy window with the frontend companion change (`proyecto-Visual-Detail`), per the proposal's cross-repo dependency. Rollback: single revert of the change PR.

## Open questions

- [ ] None blocking. Out-of-scope observation for a later change: `app.js:27` mounts `authLimiter` on `/api/auth`, but the auth router is mounted at `/api` (routes are `/api/login`, `/api/register`), so auth rate limiting currently applies to nothing. Not touched here.
