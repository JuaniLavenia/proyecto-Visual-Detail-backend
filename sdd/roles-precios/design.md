# Design: Sistema de Roles y Precios por Mayor

## Technical Approach

Implementar autenticación basada en roles (RBAC) con precios diferenciados por usuario. El backend será la fuente de verdad para el rol del usuario, eliminando el hardcoded admin check del frontend existente. Los roles se definen como enum para garantizar consistencia: `minorista` (default), `mayorista`, y `admin`. El campo `precioMayorista` en productos es opcional — si no existe, el frontend aplica descuento automático del 15%.

## Architecture Decisions

### Decision 1: Role como Enum vs String Libre

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Enum `['minorista', 'mayorista', 'admin']` | Requiere migración si se agregan roles | **Usar enum** — Prevalece valores inválidos, migración simple |
| String libre | Flexible, sin migración | No type-safe, mayor riesgo de errores |

**Rationale**: Usar enum con valores definidos previene queries por roles inexistentes. La migración es un costo único aceptable.

### Decision 2: precioMayorista como Number Opcional

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Campo único `precioMayorista: Number` | Si es null, fallback automático | **Usar campo único optional** — Simplifica schema |
| Array de tier prices | Más flexible para volúmenes | Mayor complejidad, deferido |

**Rationale**: Schema simple con fallback automático en frontend. El 15% de descuento fijo es suficiente para MVP. Volumen tiers quedan para futura iteración.

### Decision 3: Middleware Separado vs Inline Check

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `verifyRole(['admin'])` middleware separado | Más reusable, claro en rutas | **Crear middleware** — Separation of concerns |
| Inline `if (req.user.role !== 'admin')` | Menos archivos | Dificulta testing, duplicación |

**Rationale**: Middleware dedicado facilita testing y mantenimiento. El proyecto ya usa middleware para rate-limiting y errores.

### Decision 4: Role en JWT Payload vs Response

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Include role en JWT payload | El backend puede verificar sin DB | JWT más grande, requiere re-issue para role changes |
| Role solo en response | Siempre consultable desde DB | **Retornar en response** — Simpler, más seguro |

**Rationale**: El role cambia rarement, y cuando lo hace requiere confirmación. Mantener role fuera del JWT evita problemas de sincronización. El service ya retorna user.toJSON() — basta con agregar role ahi.

## Data Flow

```
┌─────────────┐     login/register      ┌──────────────────┐
│   Client    │ ─────────────────────► │ auth.controller  │
└─────────────┘                         └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  auth.service     │
                                        │  retorna user     │
                                        │  con role         │
                                        └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │   Response        │
                                        │ { token, user,   │
                                        │   userId, role }  │
                                        └──────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/models/User.js` | Modify | Agregar campo `role` con enum y default 'minorista' |
| `src/models/Product.js` | Modify | Agregar campo `precioMayorista` como Number optional |
| `src/services/auth.service.js` | Modify | Ensure role se incluye en user.toJSON() response |
| `src/routes/users.js` | Modify | Agregar ruta PUT `/:id/role` para admin cambiar roles |
| `src/middleware/auth.middleware.js` | Create | Middleware `verifyRole(allowedRoles)` |
| `src/routes/users.js` | Modify | Proteger ruta `/:id/role` con verifyRole(['admin']) |

## Interfaces / Contracts

### User Schema (Backend)

```js
// src/models/User.js
role: {
  type: String,
  enum: ['minorista', 'mayorista', 'admin'],
  default: 'minorista',
  index: true  // Para queries por rol frecuentes
}
```

### Product Schema (Backend)

```js
// src/models/Product.js
precioMayorista: {
  type: Number,
  default: null  // Si null, frontend calcula price * 0.85
}
```

### Auth Response (Backend → Frontend)

```js
// Login/Register response
{
  userId: "...",
  token: "eyJ...",
  refreshToken: "eyJ...",
  user: {
    _id: "...",
    email: "user@test.com",
    role: "minorista" | "mayorista" | "admin"
  }
}
```

### Role Management API

```js
// PUT /api/users/:id/role
// Body: { role: 'minorista' | 'mayorista' | 'admin' }
// Response: { success: true, user: { _id, email, role } }
// Auth: Bearer token + role === 'admin'
```

### Middleware Usage

```js
// src/routes/users.js
const { verifyRole } = require('../middleware/auth.middleware');

router.put('/:id/role', verifyToken, verifyRole(['admin']), updateUserRole);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | User schema validation | Test with Mongoose validation options |
| Unit | verifyRole middleware logic | Mock req.user.role, test allowed/rejected |
| Integration | Login retorna role | POST /api/auth/login, verificar role en response |
| Integration | Admin only endpoint | Login como user, attempt PUT /users/:id/role → 403 |

## Migration / Rollout

1. **Pre-deploy**: Mongodb migration para agregar role = 'minorista' a usuarios existentes sin role
2. **Deploy backend**: Nuevo schema, rutas, middleware
3. **Deploy frontend**: Actualizar useAuthStore para usar role del backend (no hardcoded)
4. **Post-deploy**: Verificar que login/register retornan role correctamente

### Migration Script (MongoDB)

```js
// migration-add-role.js
db.users.updateMany(
  { role: { $exists: false } },
  { $set: { role: 'minorista' } }
)
```

## Open Questions

- [ ] ¿El frontend está en otro repositorio o es parte de este monorepo? (La proposal menciona "frontend/" pero no existe en este repo)
- [ ] ¿Cuántos usuarios existen actualmente que requieran migración?
- [ ] ¿El descuento automático del 15% debe ser configurable?