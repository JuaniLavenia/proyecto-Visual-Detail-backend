# Exploration: fix-auth-refresh-contract (backend)

Fecha: 2026-09-01
Alcance: `proyecto-Visual-Detail-backend`. Change cross-repo, contraparte en `proyecto-Visual-Detail` (frontend).

## Estado actual confirmado

- `src/controllers/auth.controller.js`: `login` (líneas 12-25) y `register` (27-45) devuelven planto `{userId, token, refreshToken, role, user}` vía `res.json(...)` directo. `refresh` (47-53) y `logout` (55-61) envuelven con `success()` de `src/utils/response-formatter.js` → `{success, data, message}`, por lo tanto los tokens quedan en `response.data.data`.
- **Hallazgo nuevo — mismatch de nombre de campo**: `auth.service.js` `generateTokens()` siempre devuelve `{accessToken, refreshToken}`. `login`/`register` renombran el access token a `token`; `refresh` lo reenvía sin cambios como `accessToken`. Arreglar solo el envoltorio deja subsistir el split `token` vs `accessToken`.
- **Hallazgo nuevo — las respuestas de error de auth están rotas por separado**: `src/middleware/common.middleware.js` exporta un segundo `errorMidleware` de 4 argumentos, no relacionado (`res.status(500).json({message:"Internal server error"})`, sin envoltorio). `src/routes/auth.router.js` lo agrega como último handler en las 6 rutas (login, register, refresh, logout, forgot, reset — líneas 34, 57, 70, 83, 99, 114). El `Route.dispatch` de Express encuentra este error handler local antes de llegar al `error.middleware.js` de nivel de app, así que **todo `AppError` lanzado en rutas de auth (401 credenciales inválidas, 409 email duplicado, 401 refresh token inválido/expirado, etc.) hoy se traga en un 500 genérico `{message:"Internal server error"}`**, descartando el status y mensaje reales. Confirmado que ningún otro router (`users.js`, `productos.js`, `pedidos.js`, `cart.routes.js`, `favorites.routes.js`) importa este `errorMidleware` — solo `auth.router.js`.
- **Discrepancia de `verify-report.md` confirmada falsa**: `sdd/mejorar-seguridad-arquitectura-backend/verify-report.md` líneas 93, 127, 140 afirman que `response-formatter.js` / el shape `{success,data,error}` se usa "en todos los controladores" / "Response Format ✅ Yes". Es falso para `auth.controller.js` (camino de éxito de login/register y todo el camino de error vía `errorMidleware`), y también falso para `favorites.controller.js` y `cart.controller.js`, que no importan `response-formatter.js` en absoluto y devuelven shapes ad-hoc `{message, data}` / `{error: "string"}`.
- Usuarios consistentes confirmados de `success()`/`paginated()`: `users.controller.js`, `product.controller.js`, `pedidos.controller.js` (3 de los otros 4 controladores de recursos — `pedidos.controller.js` también arma a mano el mismo shape `{success:false,error}` en 3 lugares en vez de llamar a `error()`, inconsistencia cosmética pero mismo shape).
- Riesgos relacionados confirmados presentes pero explícitamente fuera de alcance (diferidos a la unidad 6 de hardening): `User.js` guarda `refreshToken` como `String` plano (sin hash, comentario en `auth.service.js:52` lo admite); `config/index.js:63` default de `jwt.secret` a `'change-me-in-production'`; `app.js:31` usa `cors()` sin opciones.
- No hay test runner (confirmado vía `package.json`, `openspec/config.yaml`) — sin red de seguridad automatizada para este change.

## Consumidores del frontend (cross-repo, `proyecto-Visual-Detail`) — confirmado leyendo el código real

- `src/pages/Auth/index.jsx` líneas 74 y 112: destructuran `{token, userId, role, user, refreshToken}` directo de `res.data` — coincide con el shape plano actual de login/register.
- `src/lib/api.js` `refreshAccessToken()` línea 224: `const {accessToken, refreshToken: newRefreshToken} = response.data;` — espera un shape **plano** de `/api/refresh`, pero el backend manda `{success,data:{accessToken,refreshToken},message}`. Ambos valores destructurados son `undefined` hoy.
- `src/App.jsx` líneas 41-48: `if (token && refreshToken) { updateTokens(...) } else { logout() }` — como `token` es `undefined`, esta rama **fuerza el logout del usuario aunque el refresh del backend haya sido exitoso**. Este es el mecanismo exacto del bug reportado.
- `src/stores/useAuthStore.js` `logoutWithApi()` (líneas 51-67): `fetch` fire-and-forget, nunca parsea el body de la respuesta de `/api/logout` — el shape del envoltorio de logout no tiene impacto funcional actual en el frontend, pero igual conviene estandarizarlo.

## Áreas afectadas

- `src/controllers/auth.controller.js` — `login`, `register` (envolver), `refresh`/`logout` (mantener), decisión de nombre de campo.
- `src/routes/auth.router.js` — quitar `errorMidleware` de las 6 definiciones de ruta.
- `src/middleware/common.middleware.js` — `errorMidleware` queda como código muerto una vez sacado del router; candidato a eliminación.
- `sdd/mejorar-seguridad-arquitectura-backend/verify-report.md` — necesita una nota de corrección agregada (rastro de auditoría — no reescribir en silencio), no se toca directamente en este change pero debe quedar señalado en la propuesta.
- Cross-repo (no es de este repo editarlo, pero sí el contrato objetivo): `proyecto-Visual-Detail/src/lib/api.js`, `src/pages/Auth/index.jsx`.
- Explícitamente fuera de alcance, misma clase de defecto, señalado para después: `favorites.controller.js`, `cart.controller.js` (no usan el formatter en absoluto).

## Propuesta de contrato de interfaz (para la exploración paralela del frontend)

```
POST /api/login -> 200 / POST /api/register -> 201
{ "success": true, "data": { "userId", "accessToken", "refreshToken", "role", "user": {...} }, "message": null }

POST /api/refresh -> 200
{ "success": true, "data": { "accessToken", "refreshToken" }, "message": "Token refrescado" }

POST /api/logout -> 200
{ "success": true, "message": "Logout exitoso" }   // "data" se omite cuando es null

Errores (todos los endpoints de auth, una vez que se quite errorMidleware):
{ "success": false, "error": { "message": "...", "code": "AUTH_INVALID|USER_EXISTS|TOKEN_EXPIRED|INVALID_TOKEN|..." } }
con el status HTTP real (401/409/400), no un 500 genérico.
```

## Alternativas evaluadas

1. **Opción A — Envolver login/register con `success()`, estandarizar el campo en `accessToken`**. Coincide con la convención dominante (3 de los otros 4 controladores); produce un envoltorio de éxito+error coherente una vez que también se saca `errorMidleware`; diff mínimo (2 funciones); coincide con la dirección ya registrada en `PLAN-CAMBIOS-ADMIN-PLP-AUTH.md`. Contras: el frontend debe actualizar 2 sitios de destructuring. Esfuerzo: bajo.
2. **Opción B — Desenvolver refresh/logout a plano, igual que login/register**. Cero cambios de frontend para `/api/refresh` y `/api/logout`. Contras: hace que auth diverja del resto de la API (users/products/pedidos están todos envueltos) — cambia una inconsistencia interna por una inconsistencia a nivel de toda la API; contradice la dirección ya declarada en el plan. Esfuerzo: bajo, pero arquitectónicamente peor.
3. **Opción C — Envolver (como A) pero mantener `token` como nombre de campo**. Sin rename en login/register. Contras: requiere un rename equivalente dentro de `refresh` (`accessToken`→`token`) o el split de nombres sobrevive invertido.

## Decisión (2026-09-01)

**Opción A**, con el campo estandarizado en `accessToken`, más la eliminación de `errorMidleware` de `auth.router.js` en el mismo change — es la misma superficie de defecto del "contrato de respuesta de auth" y, si no se corrige, el propio caso de prueba manual "refresh token inválido/expirado" de este change no se puede verificar correctamente (devolvería 500 genérico en vez del 401 esperado). Se agrega una nota de corrección a `verify-report.md` en vez de reescribirlo. `favorites.controller.js`/`cart.controller.js` quedan explícitamente diferidos a un change posterior (misma clase de defecto, fuera de alcance de la unidad 1).

## Casos de prueba manual

Sin test runner — verificación manual/estática.

1. Login/register exitoso → shape `{success,data:{...,accessToken,...}}` → frontend extrae `accessToken` correctamente.
2. Expiración de access token → refresh exitoso → tokens extraídos (no `undefined`) → request original reintentada con éxito.
3. Refresh token inválido/expirado → responde 401 real con `{success:false,error:{message,code}}` (no 500 genérico) → frontend desloguea correctamente.
4. Rotación de refresh token → el token viejo deja de ser usable.
5. Logout → responde `{success:true,message}`.
6. Credenciales inválidas en login → 401 real con mensaje real (no 500 genérico) — regresión directa de sacar `errorMidleware`.
7. Email duplicado en register → 409 real con mensaje real (no 500 genérico).

## Riesgos

- Sin test runner — verificación manual/estática únicamente para el cambio de envoltorio y la eliminación de `errorMidleware`.
- El bug de `errorMidleware` es un defecto nuevo, previamente no documentado, en el mismo camino de código; si se dejara fuera de alcance, debe quedar señalado explícitamente como defecto conocido remanente.
- Riesgo de coordinación cross-repo: un merge solo del backend sin el cambio correspondiente del frontend rompe login/register o refresh sin importar qué opción se elija.
- `forgotPassword`/`resetPassword` comparten archivo/router pero tienen una tercera familia de shape de respuesta sin tocar — requiere confirmación de alcance con el usuario.
- La decisión de nombre de campo (`token` vs `accessToken`) es un fork real; saltearla reintroduce una versión más chica del mismo bug.

## Listo para propuesta

Sí — diagnóstico confirmado, un defecto adicional encontrado (`errorMidleware`), y un contrato de interfaz cross-repo concreto definido.
