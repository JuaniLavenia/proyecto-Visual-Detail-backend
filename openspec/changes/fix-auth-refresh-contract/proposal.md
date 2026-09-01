# Proposal: Fix Auth Response Contract

## Intent

Auth emits three incompatible response shapes: `login`/`register` return flat `{userId, token, ...}`, while `refresh`/`logout` return `success()`-wrapped `{success, data, message}`. Separately, `auth.router.js` attaches `errorMidleware` as a per-route error handler on all 6 routes; Express resolves it before the app-level `errorMiddleware`, collapsing every real auth error (401 credentials, 409 duplicate email, 401 expired refresh) into a generic `500 {message:"Internal server error"}`.

Effect: `refreshAccessToken()` destructures `undefined` and forces a logout after a *successful* refresh, and no auth error carries its real status.

## Scope

### In Scope
- Wrap `login`/`register` with `success()`; name the access token `accessToken` in all 4 endpoints. Statuses unchanged.
- Remove `errorMidleware` from the 6 routes and the import in `auth.router.js`.
- Delete `errorMidleware` from `common.middleware.js` — verified sole consumer was `auth.router.js`; the other 5 routers import only `requestValidation`. Leaving it invites re-attaching the same defect.
- Remove the unreachable 422 `validationResult` block in `register`: `requestValidation` validates first, so it can never fire.
- Append (never rewrite) a correction note to `sdd/mejorar-seguridad-arquitectura-backend/verify-report.md`: its "response format used in all controllers" claim is false for auth, favorites and cart.

### Out of Scope
- `forgotPassword`/`resetPassword`; `favorites.controller.js`; `cart.controller.js` — separate changes.
- Unit-6 hardening: plaintext `refreshToken`, `jwt.secret` default, open `cors()`.
- No new UX or behavior. Data contract only.

## Target Contract

```text
POST /api/login    -> 200 { success, data: { userId, accessToken, refreshToken, role, user }, message }
POST /api/register -> 201 { success, data: { userId, accessToken, refreshToken, role, user }, message }
POST /api/refresh  -> 200 { success, data: { accessToken, refreshToken }, message }
POST /api/logout   -> 200 { success, message }
Errors (all auth) -> real status (401/409/400) { success: false, error: { message, code } }
```

Errors come from the existing app-level `errorMiddleware` (`error.stack` in development only).

## Capabilities

### New Capabilities
- `auth-response-contract`: envelope, token naming, status and error propagation for login/register/refresh/logout. `openspec/specs/` is empty, so this is a first full spec, not a delta.

### Modified Capabilities
- None.

## Approach

Option A: converge auth on the `success()` envelope already used by `users`, `product` and `pedidos`, rather than unwrapping `refresh`/`logout` — that would make auth diverge from the whole API. `generateTokens()` already returns `{accessToken, refreshToken}`, so standardizing removes a rename instead of adding one. Removing the local handler lets `AppError` reach the app-level middleware; no new error-mapping code.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/controllers/auth.controller.js` | Modified | Wrap `login`/`register`; `token` -> `accessToken`; drop dead 422 block |
| `src/routes/auth.router.js` | Modified | Remove `errorMidleware` (6 routes + import) |
| `src/middleware/common.middleware.js` | Modified | Delete `errorMidleware`; keep `requestValidation` |
| `sdd/.../verify-report.md` | Modified | Append correction note |
| `proyecto-Visual-Detail` | External | Companion PR, ships together |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backend merges without frontend | High | One deploy window; both PRs share this change name |
| No test runner | High | 7 manual cases from `exploration.md` are the checklist |
| Hidden 500s become real 401/409 | Medium | Intended; cases 3, 6, 7 assert each status |
| `response-formatter.error()` adds `error.statusCode`, unlike `error.middleware.js` | Low | Unused by auth; noted for favorites/cart |

Security-sensitive per `openspec/config.yaml`, though no token generation, hashing or expiry logic changes.

## Rollback Plan

Single revert of the change PR. Edits are localized and stateless — no schema, migration, persisted data or token-format change — so a revert fully restores prior behavior; the frontend keeps working against the flat shape it already expects.

## Dependencies

- Frontend companion change `fix-auth-refresh-contract` in `proyecto-Visual-Detail`.
- No new packages, config keys or env vars.

## Success Criteria

- [ ] All 4 endpoints return `{success, data, message}` with the token named `accessToken`.
- [ ] `errorMidleware` is gone; `requestValidation` still works in the other 5 routers.
- [ ] Invalid credentials 401, duplicate email 409, invalid/expired refresh 401 — real message and `code`, never a generic 500.
- [ ] Successful refresh no longer forces a frontend logout; rotation still invalidates the old token.
- [ ] All 7 manual cases pass; correction note appended without altering existing content.
