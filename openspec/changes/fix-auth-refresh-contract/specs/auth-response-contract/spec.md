# Delta for auth-response-contract

`openspec/specs/` is empty, so this delta is the first full spec for this capability; all requirements are new, under `## ADDED Requirements`.

## ADDED Requirements

### Requirement: Login and Register Success Envelope

The system MUST wrap `POST /api/login` (200) and `POST /api/register` (201) success responses in `{success: true, data, message}`, and MUST name the token field `accessToken` (not `token`).

#### Scenario: Successful login
- GIVEN valid credentials
- WHEN calling `POST /api/login`
- THEN response is `200 {success: true, data: {userId, accessToken, refreshToken, role, user}, message}`

#### Scenario: Successful registration
- GIVEN an unregistered email
- WHEN calling `POST /api/register`
- THEN response is `201` with the same `data` shape as login
- AND the unreachable post-validation 422 branch does not run, since `requestValidation` already rejected invalid input upstream

### Requirement: Refresh and Logout Success Envelope

The system MUST return `200 {success: true, data: {accessToken, refreshToken}, message}` for a valid `POST /api/refresh`, and `200 {success: true, message}` for `POST /api/logout`, regardless of the refresh token's prior validity.

#### Scenario: Successful refresh does not force logout
- GIVEN a valid, non-expired, non-revoked refresh token
- WHEN calling `POST /api/refresh`
- THEN response is `200` with rotated `data.accessToken` and `data.refreshToken`
- AND the client MUST NOT treat this as a failure or log the user out

#### Scenario: Logout is idempotent
- GIVEN a refresh token that is valid, expired, or unknown
- WHEN calling `POST /api/logout`
- THEN response is `200 {success: true, message}`

### Requirement: Auth Error Response Contract

All auth errors (login, register, refresh, logout) MUST flow through the app-level `errorMiddleware` only; no per-route `errorMidleware` handler MUST exist anywhere in the codebase. Every error response MUST carry the real HTTP status and the shape `{success: false, error: {message, code}}`.

#### Scenario: Invalid login credentials
- GIVEN a non-matching email/password
- WHEN calling `POST /api/login`
- THEN response is `401 {success: false, error: {message, code: "AUTH_INVALID"}}`

#### Scenario: Duplicate email on register
- GIVEN an already-registered email
- WHEN calling `POST /api/register`
- THEN response is `409 {success: false, error: {message, code: "USER_EXISTS"}}`

#### Scenario: Missing refresh token
- GIVEN a request body without `refreshToken`
- WHEN calling `POST /api/refresh`
- THEN response is `400 {success: false, error: {message, code: "REFRESH_TOKEN_REQUIRED"}}`

### Requirement: Refresh Token Invalid or Expired Handling

When the refresh token on `POST /api/refresh` is malformed, revoked, or expired, the system MUST return `401 {success: false, error: {message, code}}` with `code` `"INVALID_TOKEN"` or `"TOKEN_EXPIRED"` respectively. The client SHALL treat this as terminal and MUST log the user out.

#### Scenario: Expired refresh token
- GIVEN a refresh token past its expiry
- WHEN calling `POST /api/refresh`
- THEN response is `401` with `code: "TOKEN_EXPIRED"`
- AND the client MUST log the user out

#### Scenario: Revoked or unknown refresh token
- GIVEN a refresh token not matching the one stored for its user
- WHEN calling `POST /api/refresh`
- THEN response is `401` with `code: "INVALID_TOKEN"`
- AND the client MUST log the user out

### Requirement: Access Token Expiry Is Distinct From Refresh Failure

An access token expiring on any protected, non-auth endpoint (via the `authenticate` middleware) MUST return `401 {success: false, error: {message, code: "TOKEN_EXPIRED"}}` from that endpoint, not from `/api/refresh`. This SHALL NOT be treated as equivalent to a failed refresh: the client MUST attempt `POST /api/refresh` before logging out.

#### Scenario: Access token expired on a protected endpoint
- GIVEN an expired access token and a still-valid refresh token
- WHEN calling any protected, non-auth endpoint
- THEN response is `401` with `code: "TOKEN_EXPIRED"` from that endpoint
- AND the client MUST attempt `POST /api/refresh` before logging out

## Out of Scope (Note, not a requirement)

`forgotPassword`/`resetPassword` and the `favorites`/`cart` controllers keep their current, inconsistent response shapes; each is a separate future change.
