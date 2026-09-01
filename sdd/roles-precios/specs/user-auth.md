# User Auth Specification

## Purpose

Handle user authentication (login/register) and include role information in authentication responses.

## Requirements

### Requirement: Login returns role field

The system MUST return the user's role in the login response.

When a user authenticates with valid credentials, the response SHALL include:
- userId: string
- token: string
- role: string (one of "minorista", "mayorista", "admin")
- user: object

#### Scenario: Login success with minorista role

- GIVEN a user with email "user@test.com" and password "validpass" exists with role "minorista"
- WHEN user submits POST /api/auth/login with email and password
- THEN response contains userId, token, role: "minorista", and user object

#### Scenario: Login success with mayorista role

- GIVEN a user with role "mayorista" exists in the database
- WHEN user authenticates successfully
- THEN response contains role: "mayorista"

#### Scenario: Login with existing user without role field

- GIVEN a user exists in database WITHOUT role field defined
- WHEN user authenticates successfully
- THEN backend assigns role "minorista" by default in response

### Requirement: Register creates user with default role

The system MUST assign default role "minorista" to new users during registration.

#### Scenario: Register new user

- GIVEN user submits POST /api/auth/register with email "new@test.com" and password "validpass"
- WHEN registration succeeds
- THEN new user is created with role "minorista" by default
- AND response contains role: "minorista"

## Response Format

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "minorista",
  "user": {
    "email": "user@test.com",
    "role": "minorista"
  }
}
```