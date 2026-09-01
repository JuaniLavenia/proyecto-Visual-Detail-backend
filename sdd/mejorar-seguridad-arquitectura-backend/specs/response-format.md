# Response Format Specification

## Purpose

Estructura consistente de respuestas JSON en toda la API.

## Requirements

### Requirement: Standard Response Envelope

El sistema DEBE usar formato consistente {success, data, error} en TODAS las respuestas.

#### Scenario: Successful response

- GIVEN operación exitosa
- WHEN devuelve respuesta
- THEN formato: {"success": true, "data": {...}}

#### Scenario: Error response

- GIVEN operación fallida
- WHEN devuelve respuesta
- THEN formato: {"success": false, "error": {"message": "...", "code": "..."}}

#### Scenario: Paginated response

- GIVEN request de lista con paginación
- WHEN devuelve respuesta
- THEN incluye: {"success": true, "data": {...}, "pagination": {...}}

### Requirement: No Exposed Stack Traces

El sistema DEBE NO exponer stack traces en producción.

#### Scenario: Error in production

- GIVEN error en ambiente de producción
- WHEN devuelve respuesta
- THEN solo incluye message público, no stack trace