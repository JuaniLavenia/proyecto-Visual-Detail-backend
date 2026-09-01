# Design: mejorar-seguridad-arquitectura-backend

## Technical Approach

Fase por fase implementación de mejoras de seguridad y arquitectura: (1) middlewares de seguridad, (2) servicios de validación, (3) service layer, (4) JWT refresh, (5) error handling centralizado, (6) DB resilience. El objetivo es mantener compatibilidad con el API actual mientras se agregan las capas de seguridad.

## Architecture Decisions

### Decision: Middleware Stack Order

**Choice**: helmet → cors → rate-limit → express.json → routes
**Alternatives considered**: Aplicar rate-limit por ruta individual
**Rationale**: Rate limiting global es más simple de mantener y cubre todos los endpoints. Se puede refinar después con custom stores.

### Decision: Service Layer Pattern

**Choice**: Controllers delegan 100% a services. Services contienen lógica de negocio y usan Models directamente.
**Alternatives considered**: Controllers con algo de lógica, services solo como utility functions
**Rationale**: Separación clara facilita testing y mantenimiento. Los controllers solo manejan HTTP (req/res).

### Decision: JWT Refresh Token Storage

**Choice**: Refresh tokens almacenados en MongoDB (campo refreshToken en User model)
**Alternatives considered**: JWT sin store (invalidación más difícil), Redis (agrega complejidad)
**Rationale**: MongoDB ya está disponible. Permite revocación de tokens y tracking de sesiones.

### Decision: Response Format

**Choice**: { success: boolean, data?: any, error?: { message: string, code?: string } }
**Alternatives considered**: { status, message, data }, API Problem format
**Rationale**: Simple y reconocible. Compatible con el código existente migrando gradualmente.

### Decision: Environment Validation

**Choice**: convict con schema embebido en config/index.js
**Alternatives considered**: env-var, dotenv-validator, custom
**Rationale**: convict es maduro, soporta tipos, defaults, y validación en un solo lugar.

## Data Flow

```
Request
  ↓
helmet (headers) → cors → rate-limit → validation (express-validator) → controller
                                                                    ↓
                                                              service (negocio)
                                                                    ↓
                                                              model (MongoDB)
                                                                    ↓
Response Formatter ← errorMiddleware ← service result
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `config/index.js` | Create | Schema de variables de entorno con convict |
| `config/default.json` | Create | Valores por defecto |
| `middlewares/error.middleware.js` | Create | Middleware de errores centralizado |
| `middlewares/rate-limiter.js` | Create | Rate limiting configurable |
| `utils/query-sanitizer.js` | Create | Sanitizador de queries MongoDB |
| `utils/response-formatter.js` | Create | Helper para formato consistente |
| `services/auth.service.js` | Create | Lógica de auth (login, register, refresh) |
| `services/user.service.js` | Create | CRUD usuarios |
| `services/product.service.js` | Create | CRUD productos |
| `services/pedido.service.js` | Create | CRUD pedidos |
| `models/User.js` | Modify | Agregar refreshToken, métodos de validación |
| `index.js` | Modify | Agregar helmet, rate-limit, error middleware, config validation, DB retry |
| `routes/auth.router.js` | Modify | Agregar validation en login, forgot, reset |
| `routes/users.js` | Modify | Agregar validation |
| `routes/productos.js` | Modify | Agregar validation |
| `routes/pedidos.js` | Modify | Agregar validation |
| `routes/favorites.routes.js` | Modify | Agregar validation |
| `routes/cart.routes.js` | Modify | Agregar validation |
| `controllers/auth.controller.js` | Modify | Delegar a auth.service |
| `controllers/users.controller.js` | Modify | Delegar a user.service |
| `controllers/product.controller.js` | Modify | Delegar a product.service |
| `controllers/pedidos.controller.js` | Modify | Delegar a pedido.service |
| `.env.example` | Modify | Agregar todas las variables requeridas |

## Interfaces / Contracts

### Service Interface
```javascript
// services/auth.service.js
{
  login(email, password) → { user, accessToken, refreshToken }
  register(email, password) → { user }
  refresh(refreshToken) → { accessToken, refreshToken }
  logout(refreshToken) → void
}
```

### Response Format
```javascript
// Éxito
{ success: true, data: { ... } }
// Error
{ success: false, error: { message: "...", code: "AUTH_INVALID" } }
```

### Config Schema (convict)
```javascript
{
  port: port,
  env: enum(['development', 'production']),
  mongo: { uri: url, options: { ... } },
  jwt: { secret: string, accessExpiry: string, refreshExpiry: string },
  rateLimit: { windowMs: number, max: number }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Services, query-sanitizer, response-formatter | Jest/Mocha con mocks de mongoose |
| Integration | Endpoints con request real a DB | Supertest |
| E2E | Flujo completo auth (register → login → refresh → logout) | Postman/newman o script |

## Migration / Rollout

1. **Fase 1-2**: Middlewares y utilities (sin cambios en contratos)
2. **Fase 3**: Services layer (controllers原有的逻辑迁移到services)
3. **Fase 4**: JWT refresh (nuevo endpoint /refresh)
4. **Fase 5-6**: Error handling y DB retry (sin breaking changes)

No se requiere migración de datos. La aplicación puede correr en paralelo con la versión anterior durante el deploy.

## Open Questions

- [ ] ¿El rate limit debe persistir en Redis para múltiples instancias?
- [ ] ¿We need to support API versioning (/api/v1) desde el inicio?
- [ ] ¿Logs de errores a servicio externo (Datadog, Sentry) o solo console?