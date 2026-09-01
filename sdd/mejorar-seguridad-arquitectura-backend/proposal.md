# Proposal: mejorar-seguridad-arquitectura-backend

## Intent

El backend actual de Visual Detail tiene vulnerabilidades críticas y deuda técnica que comprometen seguridad, mantenibilidad y escalabilidad. No hay validación en la mayoría de endpoints, queries MongoDB sin sanitizar, JWT sin refresh tokens, y controladores mezclan responsabilidades. Este cambio implementing las mejoras de seguridad y arquitectura necesarias para producción.

## Scope

### In Scope
1. **Validación de entrada en TODOS los endpoints** — express-validator en todas las rutas (actualmente solo en register)
2. **Sanitización de queries MongoDB** — prevención de injection en find/update
3. **Rate limiting** — límites por IP/endpoints sensibles (login, register)
4. **Headers de seguridad** — helmet con CSP, HSTS, X-Frame-Options
5. **Refresh tokens para JWT** — implementación de access + refresh token
6. **Separación de responsabilidades** — services layer para lógica de negocio
7. **Manejo de errores centralizado** — middleware de errores unificado
8. **Estructura de respuestas consistente** — formato {success, data, error}
9. **Variables de entorno estructuradas** — schema con convict/env-var
10. **Conexión a DB con retry logic** — mongoose con reconnect y health checks

### Out of Scope
- Migración a TypeScript
- Implementación de WebSockets
- Cacheo con Redis
- Tests unitarios (futuro cambio)

## Capabilities

### New Capabilities
- `api-validation`: Validación completa de requests en todos los endpoints
- `query-sanitization`: Capa de sanitización para queries MongoDB
- `rate-limiting`: Protección contra bruteforce y DoS
- `security-headers`: Headers de seguridad HTTP
- `jwt-refresh`: Sistema de refresh tokens
- `service-layer`: Separación controllers/services/models
- `error-handling`: Manejo centralizado de errores
- `response-format`: Estructura consistente de respuestas API
- `env-validation`: Validación de variables de entorno al startup
- `db-resilience`: Reconexión automática a MongoDB

### Modified Capabilities
- `user-auth`: Cambia de JWT simple a JWT con refresh tokens

## Approach

1. **Fase 1**: Middlewares de seguridad (headers, rate limiting, sanitización)
2. **Fase 2**: Servicios de validación y estructura de respuestas
3. **Fase 3**: Services layer + validación completa en rutas
4. **Fase 4**: JWT refresh tokens
5. **Fase 5**: Error handling centralizado + env validation
6. **Fase 6**: Retry logic en conexión MongoDB

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `index.js` | Modified | Agregar middlewares, DB retry, helmet |
| `routes/*.js` | Modified | Agregar validación en todos los endpoints |
| `controllers/*.js` | Modified | Mover lógica a services |
| `middlewares/common.middleware.js` | Modified | Error handling centralizado |
| `services/` | New | Capa de servicios |
| `utils/query-sanitizer.js` | New | Sanitización MongoDB |
| `utils/response-formatter.js` | New | Formato consistente |
| `config/` | New | Schema de variables de entorno |
| `.env.example` | New | Plantilla de variables requeridas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking changes en API | Medium | versioning con /api/v1 |
| downtime en deploy | Low | health checks antes de tráfico |
| rate limit false positives | Medium | configurar límites generosos inicialmente |

## Rollback Plan

1. Revertir cambios en index.js a versión anterior
2. Mantener archivos old/ como backup durante 1 semana
3. Rollback via git: `git revert --no-commit HEAD~1` si hay problemas críticos

## Dependencies

- `helmet` — headers de seguridad (instalar)
- `express-rate-limit` — rate limiting (instalar)
- `mongoose` — ya tiene reconnect logic, solo configurar

## Success Criteria

- [ ] Todos los endpoints tienen validación con express-validator
- [ ] Queries MongoDB pasan por sanitizer antes de ejecutarse
- [ ] Rate limiting activa en /login, /register (100 req/15min)
- [ ] Headers helmet activos en todas las respuestas
- [ ] Refresh tokens implementados con rotación
- [ ] Controllers no tienen lógica de negocio (solo services)
- [ ] Error middleware maneja TODOS los errores
- [ ] Todas las respuestas siguen formato {success, data, error}
- [ ] App no inicia sin variables requeridas
- [ ] Reconexión automática a MongoDB configurada
