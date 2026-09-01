# Rate Limiting Specification

## Purpose

Protección contra ataques de fuerza bruta y DoS mediante límites de requests por IP.

## Requirements

### Requirement: Rate Limit on Authentication Endpoints

El sistema DEBE aplicar rate limiting en endpoints de autenticación.

#### Scenario: Normal login attempts

- GIVEN usuario con 5 intentos de login fallidos
- WHEN supera el límite de 100 req/15min
- THEN los primeros 100 requests se procesan normalmente

#### Scenario: Exceeding rate limit

- GIVEN atacante con 101+ requests a /login en 15 minutos
- WHEN envía request adicional
- THEN retorna 429 Too Many Requests

#### Scenario: Different IPs have separate limits

- GIVEN dos IPs diferentes enviando requests
- WHEN ambas IPs alcanzan límite simultáneamente
- THEN cada una recibe su propio error 429

### Requirement: Rate Limit Configuration

El sistema DEBE permitir configurar límites por endpoint.

#### Scenario: Login has stricter limit

- GIVEN límite de 100 req/15min para /login
- WHEN configura /register con mismo límite
- THEN ambos tienen límites independientes

#### Scenario: Custom limits per endpoint

- GIVEN endpoint /admin con límite de 50 req/15min
- WHEN request a /admin excede el límite
- THEN retorna 429