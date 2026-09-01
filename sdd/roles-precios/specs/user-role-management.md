# User Role Management Specification

## Purpose

Allow administrators to view and modify user roles in the system.

## Requirements

### Requirement: Admin can list all users

The system MUST provide an endpoint to retrieve all users with their roles.

Only users with role "admin" SHALL be able to access this endpoint.

#### Scenario: Admin lists all users

- GIVEN user is authenticated with role "admin"
- WHEN user makes GET /api/admin/users request
- THEN response contains list of all users with email and role

#### Scenario: Non-admin cannot list users

- GIVEN user is authenticated with role "minorista"
- WHEN user makes GET /api/admin/users request
- THEN request is rejected with 403 Forbidden

### Requirement: Admin can update user role

The system MUST allow administrators to change any user's role.

#### Scenario: Admin changes user role to mayorista

- GIVEN user A with role "admin" exists
- AND user B with role "minorista" exists
- WHEN user A sends PUT /api/admin/users/{userId}/role with role: "mayorista"
- THEN user B's role is updated to "mayorista"
- AND response contains updated user

#### Scenario: Admin changes user role to admin

- GIVEN admin updates another user's role to "admin"
- THEN the target user's role becomes "admin"

### Requirement: User role values

The system MUST accept only valid role values.

Valid roles are: "minorista", "mayorista", "admin"

#### Scenario: Invalid role rejected

- GIVEN admin sends PUT /api/admin/users/{userId}/role with role: "superadmin"
- THEN validation fails with error "Invalid role value"

## Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/admin/users | List all users | admin only |
| PUT | /api/admin/users/:id/role | Update user role | admin only |
| GET | /api/admin/users/:id | Get single user | admin only |