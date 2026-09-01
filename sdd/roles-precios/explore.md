# Exploration: Sistema de Roles y Precios por Mayor

## Current State

### Backend - Modelos

**User.js** — Estructura minima, sin roles:
- Solo campos: `email`, `password`, `refreshToken`
- No existe campo `role` ni `isAdmin` en la base de datos
- El modelo NO soporta diferentes tipos de usuario

**Product.js** — Precio unico, sin precios por mayor:
- Solo campo `price: Number` (unico)
- No hay soporte para precios diferenciados por cantidad o rol

### Frontend - Auth

**useAuthStore.js** — Stores de Zustand con persistencia:
- Guarda `token`, `userId`, `isAdmin` en localStorage
- **CRITICAL**: El check de admin esta HARDCODED: `userId === "65dbfbfdbbaccc7f307ebc2e"` en Auth/index.jsx linea 70
- Esta no es una solucion escalable - el rol debe venir del backend

**Auth/index.jsx** — Pantalla de login/registro:
- Solo email/password, sin seleccion de rol
- Registro siempre crea usuario normal (linea 108: `login(token, userId, false)`)

### Frontend - Precios

**ProductCard/index.jsx** — Muestra precio simple:
- Linea 254: `${price.toLocaleString("es-AR")}`
- Sin logica de rol para mostrar precio mayorista
- Mismo precio para todos los usuarios

### Admin

- Ya existe panel en `/admin/Products`
- ProductCreate.jsx y ProductEdit.jsx solo aceptan un precio

---

## Affected Areas

| File | Why |
|------|-----|
| `src/models/User.js` | Necesita campo role |
| `src/models/Product.js` | Necesita precios por mayor (tiers) |
| `src/routes/auth.router.js` | Debe retornar role del usuario |
| `src/stores/useAuthStore.js` | Debe usar role del backend, no hardcoded |
| `src/components/shared/ProductCard/index.jsx` | Debe mostrar precio segun rol |
| `src/pages/admin/Products/ProductCreate.jsx` | Debe permitir ingresar precios por mayor |

---

## Approaches

### Approach 1: Roles basicos + precios por cantidad (RECOMMENDED)

Agregar a Product:
```js
pricing: {
  default: Number,      // precio retail
  wholesale: [{         // precios por cantidad
    minQty: Number,
    price: Number
  }]
}
```

Agregar a User:
```js
role: {
  type: String,
  enum: ['customer', 'wholesaler', 'admin'],
  default: 'customer'
}
```

- **Pros**: Flexible, soporta mayoristas con volumen y con rol
- **Cons**: Requiere cambios en schema, API, y frontend
- **Effort**: Medium-High

### Approach 2: Solo roles de usuario

Simplemente agregar `role` a User, precios unicos por usuario.

- **Pros**: Simple de implementar
- **Cons**: No soporta precios por cantidad, menos flexible
- **Effort**: Low-Medium

### Approach 3: Solo precios por cantidad (sin roles)

Solo agregar precios por volumen en Product.

- **Pros**: Simple, no requiere cambios en auth
- **Cons**: No hay diferenciacion de cliente, cualquier usuario ve los mismos precios
- **Effort**: Low-Medium

---

## Recommendation

**Approach 1** — Roles + precios por cantidad.理由:

1. El sistema claramente necesita distinguir entre clientes retail y mayoristas
2. Los precios por cantidad son comunes en este tipo de negocio (detalle de agua)
3. El enfoque combinado da maxima flexibilidad
4. Preparado para futuro crecimiento

**Immediate fixes requeridos**:
- Eliminar el hardcoded admin check (linea 70 en Auth/index.jsx)
- El backend debe retornar el role del usuario

---

## Risks

1. **Migration de datos**: Usuarios existentes no tendran role - asignar por defecto
2. **Backend breaking change**: Si el frontend espera `isAdmin` pero el backend retorna `role`, rompe
3. **Precios por cantidad**: Requiere decidir logica de visualizacion (si mostrar rango o precio aplicado)

---

## Ready for Proposal

**Yes** — La exploracion esta completa. El orchestrator debe indicar:

1. ¿Que enfoque prefieren (1, 2, o 3)?
2. ¿Cuales son los roles exactos que necesitan?
3. ¿Tienen una logica clara de precios por cantidad (ej: 10+ unidades = 15% descuento)?