# Sistema de Roles y Precios Diferenciados - Specification

## Purpose

Implement role-based user system with differentiated pricing for wholesale customers. The backend serves as the single source of truth for user roles.

## Domains

| Domain | Type | Description |
|--------|------|-------------|
| user-auth | Modified | Login/register now returns user role |
| product-catalog | Modified | Display price based on authenticated user's role |
| user-role-management | New | Admin panel for managing user roles |

## Requirements

### Domain: user-auth

#### Requirement: Login returns role field

The system MUST return the user's role in the login response.

When a user authenticates with valid credentials, the response SHALL include:
- userId: string
- token: string
- role: string (one of "minorista", "mayorista", "admin")
- user: object

**Scenario: Login success**

- GIVEN user with valid credentials exists with role "mayorista"
- WHEN user submits POST /api/auth/login
- THEN response contains role: "mayorista"

**Scenario: Legacy user without role**

- GIVEN user exists without role field in database
- WHEN user authenticates
- THEN backend assigns role "minorista" by default

#### Requirement: Register creates user with default role

The system MUST assign default role "minorista" to new users.

**Scenario: Register new user**

- GIVEN user submits valid registration data
- WHEN registration succeeds
- THEN new user has role: "minorista" by default

### Domain: product-catalog

#### Requirement: Product includes mayorista pricing

The Product model SHALL include:
- price: Number (required) - retail price
- priceMayorista: Number (optional) - wholesale price

When priceMayorista is null, the system SHALL apply 15% discount to price.

**Scenario: Mayorista sees wholesale price**

- GIVEN user with role "mayorista" views product
- AND product has priceMayorista: 85
- THEN displayed price is 85

**Scenario: Mayorista sees discounted price**

- GIVEN user with role "mayorista" views product
- AND product has price: 100, priceMayorista: null
- THEN displayed price is 85

### Domain: user-role-management

#### Requirement: Admin can list all users

Only users with role "admin" SHALL access user management.

**Scenario: Admin lists users**

- GIVEN authenticated user with role "admin"
- WHEN GET /api/admin/users
- THEN response contains all users with email and role

**Scenario: Non-admin denied**

- GIVEN user with role "minorista"
- WHEN accessing /api/admin/users
- THEN request rejected with 403

#### Requirement: Admin can update user role

**Scenario: Admin changes role**

- GIVEN admin sends PUT /api/admin/users/{id}/role with role: "mayorista"
- THEN target user's role is updated to "mayorista"

## Data Models

### User Model Addition

```javascript
role: {
  type: String,
  enum: ['minorista', 'mayorista', 'admin'],
  default: 'minorista'
}
```

### Product Model Addition

```javascript
precioMayorista: {
  type: Number,
  default: null
}
```

## API Response Format

### Login/Register Response

```json
{
  "userId": "...",
  "token": "...",
  "role": "mayorista",
  "user": { ... }
}
```

## Price Selection Logic

| User Role | priceMayorista | Displayed Price |
|-----------|-----------------|-----------------|
| minorista | any | price |
| mayorista | not null | priceMayorista |
| mayorista | null | price * 0.85 |