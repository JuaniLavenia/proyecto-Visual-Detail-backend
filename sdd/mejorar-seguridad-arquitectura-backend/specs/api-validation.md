# Api Validation Specification

## Purpose

Validación de entrada en TODOS los endpoints del API usando express-validator.

## Requirements

### Requirement: Validation Middleware on All Endpoints

El sistema DEBE aplicar validación de entrada en TODOS los endpoints HTTP.

#### Scenario: POST /register with valid data

- GIVEN un usuario con datos válidos (email válido, password 8+ chars, nombre presente)
- WHEN envía POST a /register
- THEN la request pasa validación y llega al controller

#### Scenario: POST /register with invalid email

- GIVEN un usuario con email inválido (sin @, sin dominio)
- WHEN envía POST a /register
- THEN retorna 400 con error de validación

#### Scenario: GET /products with invalid query params

- GIVEN query params con valores incorrectos (page=-1, limit=0)
- WHEN envía GET a /products
- THEN retorna 400 con error de validación

### Requirement: Validation Rules Per Endpoint

El sistema DEBE definir reglas de validación específicas para cada endpoint.

#### Scenario: Login requires email and password

- GIVEN request sin email o sin password
- WHEN envía POST a /login
- THEN retorna 400 con "email is required" y "password is required"

#### Scenario: Product update validates required fields

- GIVEN request con nombre vacío en update
- WHEN envía PUT a /products/:id
- THEN retorna 400 con "name cannot be empty"