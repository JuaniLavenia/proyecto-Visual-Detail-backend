# Database Resilience Specification

## Purpose

Reconexión automática a MongoDB con health checks.

## Requirements

### Requirement: Automatic Reconnection

El sistema DEBE intentar reconexión automáticamente cuando se pierde la conexión a MongoDB.

#### Scenario: MongoDB temporarily unavailable

- GIVEN conexión a MongoDB perdida
- WHEN mongoose detecta desconexión
- THEN intenta reconectar automáticamente con reintentos

#### Scenario: Reconnection succeeds

- GIVEN reconnect en progreso
- WHEN MongoDB vuelve a estar disponible
- THEN la aplicación se reconecta y continúa funcionando

#### Scenario: Max reconnection attempts reached

- GIVEN múltiples intentos de reconexión fallidos
- WHEN supera el límite de reintentos
- THEN lanza error y permite restart del proceso

### Requirement: Connection Health Check

El sistema DEBE verificar el estado de la conexión a la base de datos.

#### Scenario: Health check endpoint

- GIVEN request a /health
- WHEN verifica estado de DB
- THEN retorna estado de conexión MongoDB