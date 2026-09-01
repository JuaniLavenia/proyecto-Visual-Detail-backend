# Error Handling Specification

## Purpose

Manejo centralizado y consistente de errores en toda la aplicación.

## Requirements

### Requirement: Central Error Middleware

El sistema DEBE tener un middleware de errores que maneje TODOS los errores.

#### Scenario: Validation error returns 400

- GIVEN error de validación de express-validator
- WHEN ocurre en cualquier endpoint
- THEN retorna 400 con formato consistente

#### Scenario: Not Found returns 404

- GIVEN request a endpoint inexistente
- WHEN se procesa
- THEN retorna 404 Not Found

#### Scenario: Database error returns 500

- GIVEN error de conexión o query en MongoDB
- WHEN ocurre
- THEN retorna 500 Internal Server Error (sin exponer detalles internos)

#### Scenario: Custom application errors

- GIVEN error personalizado (ej: "Usuario no encontrado")
- WHEN se lanza
- THEN retorna código apropiado (404) con mensaje claro

### Requirement: Error Logging

El sistema DEBE registrar errores para debugging.

#### Scenario: Error is logged

- GIVEN cualquier error en producción
- WHEN ocurre
- THEN se registra en logs con stack trace