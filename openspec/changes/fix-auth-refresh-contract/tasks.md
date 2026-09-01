# Tasks: Fix Auth Response Contract

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~70-100 (additions+deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Basis: `auth.controller.js` ~30 lines (drop import, wrap 2 responses, delete dead 422 block); `auth.router.js` ~12 lines (import shrink + 6 trailing-arg removals); `common.middleware.js` ~7 lines (delete function + shrink export); `verify-report.md` ~10-15 lines (append-only note). Well under the 400-line budget; no chaining or exception needed.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | All 4 phases below, shipped together (contract fix is one atomic behavior change) | PR 1 (single) | N/A — no test runner (`openspec/config.yaml: test_runner: none`) | Manual curl/Postman per step table in `design.md`; restart server between phases | Single revert of the PR restores prior flat/500 behavior; step 2 alone (router) can be reverted independently to restore prior error status codes without touching the success envelope |

## Phase 1: Controller — Success Envelope (`src/controllers/auth.controller.js`)

- [x] 1.1 Remove the unused `const { validationResult } = require("express-validator");` import (line 7).
- [x] 1.2 In `login`, wrap the response with `success({ userId, accessToken, refreshToken, role, user }, "Login exitoso")`, renaming `token` → `accessToken`.
  - Verify: `POST /api/login` with valid credentials → `200 {success:true, data:{userId, accessToken, refreshToken, role, user}, message}`.
- [x] 1.3 In `register`, delete the unreachable `422 validationResult` block, then wrap the response with `success({...same 5 fields...}, "Registro exitoso")` at `201`.
  - Verify: `POST /api/register` with a new email → `201` with the same `data` shape as login; no `422` path exists anymore.
- [x] 1.4 Manually confirm `refresh`/`logout` (unchanged) already emit `{accessToken, refreshToken}` / `null` via `success()`.
  - Verify: `POST /api/refresh` with a valid refresh token → `200`, `data.accessToken` and `data.refreshToken` both defined; client is NOT forced to log out.

## Phase 2: Router — Remove Dead Error Handler (`src/routes/auth.router.js`)

- [x] 2.1 Remove `errorMidleware` from the destructured import; keep only `{ requestValidation }`.
- [x] 2.2 Remove the trailing `errorMidleware` argument from all 6 route registrations (`/login`, `/register`, `/refresh`, `/logout`, `/forgot`, `/reset/:id/:token`).
  - Verify: wrong password on `/api/login` → `401 {success:false, error:{message, code:"AUTH_INVALID"}}` (not 500).
  - Verify: duplicate email on `/api/register` → `409 {success:false, error:{message, code:"USER_EXISTS"}}`.
  - Verify: garbage/expired token on `/api/refresh` → `401` with `code:"INVALID_TOKEN"` or `"TOKEN_EXPIRED"`.
  - Verify: empty body on any route → still `400 {errors:[...]}` from `requestValidation` (unaffected).
  - Verify: unknown email on `/api/forgot` → still `422 {error:"No existe el usuario"}` (handler untouched).

## Phase 3: Dead Code Removal (`src/middleware/common.middleware.js`)

- [x] 3.1 Delete the `errorMidleware` function definition (lines 10-14).
- [x] 3.2 Update `module.exports` to `{ requestValidation }` only.
- [x] 3.3 Grep-verify zero remaining references to `errorMidleware` under `src/` (other 5 routers already import only `requestValidation`).
  - Verify: server boots with no `MODULE_NOT_FOUND` / undefined-handler error.
  - Verify: `GET /api/productos?page=0` → still `400 {errors:[...]}`, proving `requestValidation` resolves from the narrowed export.
  - Verify: re-run the duplicate-email case (2.2) once more — no regression.

## Phase 4: Documentation Correction (`sdd/mejorar-seguridad-arquitectura-backend/verify-report.md`)

- [x] 4.1 Append (do not edit existing lines) a correction note stating the "Response Format"/"response-formatter.js used in all controllers" claims at lines 93, 127, 140 do not hold for `auth` (now fixed by this change), `favorites`, and `cart` (still pending, out of scope).
  - Verify: diff shows additions only; lines 93, 127, 140 remain byte-identical to the original.
