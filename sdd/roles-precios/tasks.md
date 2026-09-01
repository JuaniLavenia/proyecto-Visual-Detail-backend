# Tasks: Sistema de Roles y Precios Diferenciados

## Phase 1: Backend Models (Foundation)

- [x] 1.1 Modificar User Model: agregar campo `role` con enum ['minorista', 'mayorista', 'admin'], default 'minorista' — archivo: `src/models/User.js`
- [x] 1.2 Modificar Product Model: agregar campo `precioMayorista` tipo Number, opcional — archivo: `src/models/Product.js`
- [ ] 1.3 Ejecutar migración: asignar role 'minorista' a usuarios existentes sin role — script de migración en DB

## Phase 2: Backend Auth (Core)

- [x] 2.1 Modificar Auth Service: retornar `role` en login/register response — archivo: `src/services/auth.service.js`
- [x] 2.2 Modificar Auth Controller: incluir `role` en login response y register response — archivo: `src/controllers/auth.controller.js`

## Phase 3: Backend Users API (Integration)

- [ ] 3.1 Modificar Users Controller: agregar endpoint GET /admin/users (solo admin) y PUT /admin/users/:id/role — archivo: `src/controllers/users.controller.js`
- [ ] 3.2 Modificar Users Routes: agregar rutas `/admin/users` y `/admin/users/:id/role` — archivo: `src/routes/users.js`
- [ ] 3.3 Crear Middleware: verificar token y role 'admin' — archivo: `src/middleware/auth.middleware.js` (o agregar a middleware existente)

## Phase 4: Frontend Auth Store

- [x] 4.1 Actualizar useAuthStore: guardar role en store, agregar función checkRole() — archivo: `D:\proyecto-Visual-Detail\src\stores\useAuthStore.js`
- [x] 4.2 Eliminar hardcoded admin check: remover `userId === "65dbfbfdbbaccc7f307ebc2e"` — buscar y actualizar en frontend

## Phase 5: Frontend Product Display

- [x] 5.1 Actualizar ProductCard: mostrar precio según role (mayorista = precioMayorista o price*0.85) — archivo: `D:\proyecto-Visual-Detail\src\components\shared\ProductCard\index.jsx`

## Phase 6: Frontend Admin Panel (New Feature)

- [ ] 6.1 Crear Admin Users Panel: página para listar usuarios y cambiar roles — archivo: `D:\proyecto-Visual-Detail\src\pages\admin\Users\index.jsx`
- [ ] 6.2 Agregar Route: crear ruta `/admin/usuarios` en App.jsx — archivo: `D:\proyecto-Visual-Detail\src\App.jsx`

## Phase 7: Testing & Verification

- [ ] 7.1 Verificar login retorna role: probar con usuarios existentes en staging
- [ ] 7.2 Verificar precio mayorista: login como mayorista y verificar precio mostrado
- [ ] 7.3 Verificar acceso denegado: usuario no-admin no puede acceder a /admin/users

## Phase 8: Cleanup

- [ ] 8.1 Documentar cambios enCHANGELOG
- [ ] 8.2 Remover código temporal o comentarios de debug
