# JWT Refresh Tokens Specification

## Purpose

Sistema de autenticación con access tokens y refresh tokens con rotación.

## Requirements

### Requirement: Access Token Generation

El sistema DEBE generar access tokens JWT con expiración corta (15min).

#### Scenario: Successful login returns tokens

- GIVEN credenciales válidas de usuario
- WHEN envía POST a /login
- THEN retorna access_token (15min) y refresh_token (7 días)

#### Scenario: Access token expired

- GIVEN access token expirado
- WHEN envía request autenticado
- THEN retorna 401 Unauthorized

### Requirement: Refresh Token Flow

El sistema DEBE permitir renew tokens usando refresh token.

#### Scenario: Valid refresh token

- GIVEN refresh token válido no usado
- WHEN envía POST a /refresh
- THEN retorna nuevos access_token y refresh_token

#### Scenario: Refresh token rotation

- GIVEN refresh token usado exitosamente
- WHEN hace refresh
- THEN el refresh token anterior se invalida (rotación)

#### Scenario: Invalid refresh token

- GIVEN refresh token manipulado o expirado
- WHEN envía POST a /refresh
- THEN retorna 401 Unauthorized

### Requirement: Logout Invalidates Token

El sistema DEBE invalidar refresh token en logout.

#### Scenario: Logout with valid refresh

- GIVEN usuario autenticado con refresh token
- WHEN envía POST a /logout con refresh token
- THEN el refresh token se invalida