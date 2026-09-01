# Proposal: Sistema de Roles y Precios Diferenciados

## Intent

Eliminar el hardcoded admin check del frontend y agregar soporte para roles de usuario (Minorista/Mayorista) con precios diferenciados por producto. El backend debe ser la fuente de verdad para el rol del usuario.

## Scope

### In Scope
- Agregar campo `role` al modelo User con valores: "minorista", "mayorista", "admin"
- Agregar campo `precioMayorista` al modelo Product
- Modificar auth router para retornar `role` en respuesta de login/register
- Actualizar frontend auth store para usar role del backend
- Actualizar ProductCard para mostrar precio según role del usuario
- Crear Admin Panel para gestionar usuarios y roles

### Out of Scope
- Precios por cantidad/volume tiers (deferido para futuro)
- Sistema de permisos granulares por rol
- Historial de cambios de rol

## Approach

**Approach 2 simplificado** — Roles básicos + precio mayorista único por producto:

- User Schema: agregar `role` con enum ['minorista', 'mayorista', 'admin'], default 'minorista'
- Product Schema: agregar `precioMayorista` como Number (opcional)
- Auth: retornar `{ token, userId, role }` en login/register
- Frontend: usar role del store (no hardcoded), mostrar precio según role

## Capabilities

### Modified Capabilities
- `user-auth`: El login/register retorna `role` del usuario
- `product catalog`: Mostrar precio según role del usuario logueado

### New Capabilities
- `user-role-management`: Asignar y cambiar rol de usuarios (Admin)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/models/User.js` | Modified | Agregar campo `role` |
| `src/models/Product.js` | Modified | Agregar campo `precioMayorista` |
| `src/routes/auth.router.js` | Modified | Retornar `role` en login/register |
| `src/stores/useAuthStore.js` | Modified | Usar role del backend, eliminar hardcoded |
| `src/components/shared/ProductCard/index.jsx` | Modified | Mostrar precio según role |
| `src/pages/admin/Users/` | New | Panel CRUD para gestionar usuarios y roles |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Usuarios existentes sin role | High | Migración: asignar 'minorista' por defecto a usuarios sin role |
| Frontend espera `isAdmin` pero backend retorna `role` | Medium | Actualizar frontend antes de deployar |

## Rollback Plan

1. Revertir cambios en `User.js` y `Product.js` schemas
2. Revertir auth router para retornar `{ token, userId, isAdmin }` (legacy)
3. Restaurar hardcoded admin check en frontend (temporal)
4. En database: hacer rollback del campo `role` si es necesario

## Success Criteria

- [ ] Login/register retorna campo `role` en la respuesta
- [ ] Usuarios nuevos se crean con role 'minorista' por defecto
- [ ] Productos muestran precio mayorista cuando user.role === 'mayorista'
- [ ] Admin puede ver y cambiar rol de cualquier usuario
- [ ] Eliminado el hardcoded `userId === "65dbfbfdbbaccc7f307ebc2e"` del frontend