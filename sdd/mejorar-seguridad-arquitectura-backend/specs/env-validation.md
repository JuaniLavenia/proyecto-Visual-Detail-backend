# Environment Validation Specification

## Purpose

Validación de variables de entorno al inicio de la aplicación usando schema validation.

## Requirements

### Requirement: Required Environment Variables

El sistema DEBE validar que todas las variables requeridas estén presentes al iniciar.

#### Scenario: Missing required variable

- GIVEN variable de entorno requerida no definida
- WHEN la aplicación intenta iniciar
- THEN lanza error con mensaje claro y no inicia

#### Scenario: All required variables present

- GIVEN todas las variables requeridas definidas
- WHEN la aplicación inicia
- THEN inicia normalmente

### Requirement: Type Validation

El sistema DEBE validar tipos de las variables de entorno.

#### Scenario: Invalid PORT type

- GIVEN PORT=no-numero
- WHEN la aplicación inicia
- THEN error "PORT must be a number"

#### Scenario: Invalid URL format

- GIVEN MONGO_URI con formato inválido
- WHEN la aplicación inicia
- THEN error "MONGO_URI must be a valid URI"