# Proposal: Refresh-session contract repair

## Summary
This backend slice aligns the token refresh contract and makes the session lifecycle deterministic for the client while preserving the existing refresh-token rotation model.

## Scope
- Ensure refresh responses use the shared `success` envelope consistently
- Keep the refresh token rotation logic intact and valid
- Provide a reproducible verification path for expired/invalid refresh behavior
- Keep the work constrained to the auth/session slice before broader admin and PLP work continues

## Non-goals
- Full admin CRUD work
- PLP configuration management
- Brand and category domain modeling

## Risks
- A client reading the wrong payload shape will interpret the refresh response as empty or malformed tokens.
- Token rotation errors can create unsynchronized state between backend and browser storage.
- Persistent login/logout state must be precise so only invalid/expired refresh tokens trigger session teardown.

## Delivery mode
- Interactive SDD
- Engram + OpenSpec in parallel
- Single branch used across frontend and backend repositories
