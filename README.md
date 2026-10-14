# Visual Detailing — Backend

API REST para el e-commerce de Visual Detailing. Maneja productos, marcas y categorías, usuarios, autenticación, carrito, favoritos y pedidos.

## Stack

| Tecnología | Propósito |
|---|---|
| **Node.js 20** | Runtime |
| **Express** | Framework web |
| **MongoDB + Mongoose** | Base de datos |
| **JWT** | Autenticación (access + refresh token) |
| **Bcryptjs** | Hash de contraseñas |
| **Multer** | Recepción del archivo Excel en la importación de productos |
| **XLSX** | Importación/exportación de productos en Excel |
| **Express-Validator** | Validación de requests |
| **Helmet + express-rate-limit** | Seguridad |
| **Nodemailer** | Envío de emails (recuperación de contraseña, invitaciones) |

## Estructura del proyecto

```
src/
├── config/index.js      # Configuración con convict (variables de entorno)
├── controllers/         # Controladores (capa HTTP)
├── middleware/          # auth, admin, validación, errores, rate limiting
├── models/              # Schemas de Mongoose (User, Product, Brand, Category, Cart, Favorite, Order)
├── routes/              # Definición de rutas (todas montadas bajo /api)
├── services/            # Lógica de negocio (separada de HTTP)
├── validators/          # Reglas de express-validator por recurso
├── utils/               # Sanitización de queries, formato de respuestas, mailer, CORS
├── test-helpers/        # Utilidades para los tests
├── app.js               # Configuración de Express
├── db.js                # Conexión a MongoDB (una por proceso, reintenta si falla)
├── netlify-handler.js   # Adaptador de Express a Netlify Functions
└── server.js            # Entry point como servidor (local, Docker)
netlify/functions/api.js # Entry point en Netlify
scripts/
├── seed-taxonomy.js     # Carga inicial de marcas y categorías
├── normalize-names.js   # Normaliza nombres existentes (productos, marcas, categorías)
├── backfill-home-taxonomy.js # Marca la home y carga las imágenes de categorías (una vez)
└── check-integrity.js   # Duplicados, contador de numeroPedido e índices antes de desplegar
```

## Scripts

```bash
pnpm start              # Iniciar en producción (node src/server.js)
pnpm watch              # Iniciar con node --watch
pnpm dev                # Iniciar con nodemon (desarrollo)
pnpm test               # Tests con node --test (no necesitan MongoDB)
pnpm seed:taxonomy      # Cargar marcas y categorías en la base configurada
pnpm normalize:names    # Dry-run: muestra los nombres a normalizar y las colisiones; `pnpm normalize:names -- --apply` escribe
pnpm backfill:home      # Dry-run: marca para la home las marcas/categorías activas y carga las 5 imágenes de categorías vacías; `pnpm backfill:home -- --apply` escribe
pnpm check:integrity    # Dry-run: usuarios con más de un carrito o documento de favoritos, numeroPedido repetidos y el valor del contador; `pnpm check:integrity -- --apply` siembra el contador y construye los índices (rechaza los índices únicos con duplicados, nunca borra ni fusiona)
```

## Configuración

Variables de entorno en `.env` (ver `.env-example`):

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/visual-detail
JWT_SECRET=tu-secret-aqui
FRONTEND_URL=http://localhost:5173
# Orígenes extra separados por coma (opcional)
CORS_ORIGINS=
```

### Base de datos de desarrollo

En local, `MONGODB_URI` debe apuntar a una base de **desarrollo**, nunca a la de producción: la de producción tiene clientes reales y cualquier prueba que envíe mails (recuperación de contraseña, invitaciones) les llegaría a ellos.

Para poblar la base de desarrollo, copiar las colecciones de catálogo desde producción (por ejemplo con `mongodump`/`mongorestore` o exportando desde Compass) y **no** copiar usuarios ni pedidos reales. Para probar, crear usuarios descartables con emails `@example.test`.

### Producción

- `NODE_ENV=production` y un `JWT_SECRET` propio: el servidor no arranca con el secret por defecto.
- `FRONTEND_URL` debe ser la URL real del frontend; otros orígenes van en `CORS_ORIGINS`.
- Los cambios de rol, desactivación y borrado de admins usan transacciones, que requieren un replica set (Atlas lo tiene).

## Formato de respuestas

Todas las respuestas siguen un formato estándar:

```json
// Éxito
{
  "success": true,
  "data": { ... },
  "message": "Producto creado"
}

// Paginado (listado de productos)
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalProducts": 48
  }
}

// Error
{
  "success": false,
  "error": {
    "message": "Producto no encontrado",
    "code": "PRODUCT_NOT_FOUND"
  }
}

// Error de validación (400): solo el primer error por campo, sin repetir el valor enviado
{
  "success": false,
  "error": {
    "message": "Email inválido",
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "email", "message": "Email inválido" }]
  }
}
```

En desarrollo (`NODE_ENV=development`) los errores incluyen además `error.stack`.

## Roles

- `minorista` (por defecto al registrarse): ve y compra a precio minorista (`price`).
- `mayorista`: compra a `precioMayorista` cuando el producto lo tiene.
- `admin`: acceso a las rutas de administración.

## Endpoints

Todas las rutas van bajo `/api`. "Auth" = requiere `Authorization: Bearer <accessToken>`; "Admin" = además rol `admin`.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/register` | Registro de usuario |
| `POST` | `/api/login` | Inicio de sesión; devuelve access y refresh token |
| `POST` | `/api/refresh` | Nuevo par de tokens a partir de `{ refreshToken }` |
| `POST` | `/api/logout` | Invalida el `{ refreshToken }` |
| `POST` | `/api/forgot` | Envía el mail de recuperación de contraseña |
| `POST` | `/api/reset/:id/:token` | Define una nueva contraseña con el link del mail |

### Usuarios

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/user/:id` | Auth | Perfil propio (un admin puede ver cualquiera) |
| `PUT` | `/api/user/:id` | Auth | Editar `name` y `phone` del perfil propio (`phone: ""` lo borra). El email solo lo cambia un admin (`PATCH /api/users/:id`) |
| `GET` | `/api/users` | Admin | Listado paginado con búsqueda, filtros (`role`, `status`), orden y KPIs |
| `POST` | `/api/users` | Admin | Crear/invitar un usuario (envía mail) |
| `PATCH` | `/api/users/:id` | Admin | Editar `name`, `email`, `role` o `isActive` |
| `PUT` | `/api/users/:id/role` | Admin | Cambiar el rol |
| `DELETE` | `/api/users/:id` | Admin | Eliminar un usuario sin pedidos |
| `POST` | `/api/users/:id/password-reset` | Admin | Enviar link de recuperación de contraseña |

### Productos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/productos` | Público | Listado paginado con filtros combinables (`brand`, `category`, `search`, `sort`, `page`, `limit`) |
| `GET` | `/api/productos/:id` | Público | Detalle de producto |
| `GET` | `/api/productos/stats` | Admin | Estadísticas agregadas (total, en stock, sin stock, valor total) |
| `GET` | `/api/productos/export` | Admin | Exportar a XLSX |
| `POST` | `/api/productos/bulk-upload` | Admin | Importar desde Excel (multipart, campo `file`, máx. 5 MB) |
| `POST` | `/api/productos` | Admin | Crear producto (JSON) |
| `PUT` | `/api/productos/:id` | Admin | Actualizar producto |
| `DELETE` | `/api/productos/:id` | Admin | Eliminar producto |

### Marcas y categorías

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/brands`, `/api/categories` | Público | Solo las activas |
| `GET` | `/api/brands?home=true`, `/api/categories?home=true` | Público | Activas y marcadas para la home (`_id`, `name`, `slug`, `image`), por `sortOrder` y nombre |
| `GET` | `/api/brands/all`, `/api/categories/all` | Admin | Todas, incluidas las inactivas |
| `POST` | `/api/brands`, `/api/categories` | Admin | Crear |
| `PUT` | `/api/brands/:id`, `/api/categories/:id` | Admin | Actualizar (parcial). Al renombrar, los productos con el nombre anterior pasan al nuevo; 409 si el nombre ya existe |
| `DELETE` | `/api/brands/:id`, `/api/categories/:id` | Admin | Eliminar (409 si tiene productos asociados) |

### Carrito

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/cart/:userId` | Auth | Obtener carrito |
| `POST` | `/api/cart` | Auth | Agregar / actualizar cantidad (`{ productId, quantity? }`) |
| `DELETE` | `/api/cart/:userId/:productId` | Auth | Eliminar item |

### Favoritos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/favorites/:userId` | Auth | Obtener favoritos |
| `POST` | `/api/favorites` | Auth | Agregar a favoritos (`{ productId }`) |
| `DELETE` | `/api/favorites/:userId/:productId` | Auth | Eliminar de favoritos |

### Pedidos

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/pedidos` | Auth | Crear pedido del usuario del token |
| `GET` | `/api/pedidos/:userId` | Auth | Pedidos de un usuario (propios, o cualquiera si es admin) |
| `PUT` | `/api/pedido/cancelar/:id` | Auth | Cancelar un pedido propio pendiente |
| `PUT` | `/api/pedido/modificar/:id` | Auth | Cambiar estado (`{ nuevoEstado }`): el admin cualquier estado, el dueño solo cancelar uno pendiente |
| `GET` | `/api/admin/pedidos` | Admin | Listado paginado (`page`, `limit`, `estado`, `search`) |
| `GET` | `/api/admin/pedidos/stats` | Admin | Estadísticas básicas de pedidos |
| `GET` | `/api/admin/pedidos/recent` | Admin | Pedidos recientes (`limit` 1-50) |
| `PUT` | `/api/admin/pedidos/:id/status` | Admin | Cambiar estado (`{ nuevoEstado }`) |
| `GET` | `/api/admin/estadisticas` | Admin | Estadísticas completas (pedidos, stock y usuarios) |

Body para crear un pedido (el dueño sale del token; nombre y precio salen de la base, nunca del cliente):

```json
{
  "productos": [{ "productId": "ObjectId", "cantidad": 2 }],
  "telefono": "381 4159688"
}
```

`telefono` es opcional si el perfil ya tiene uno; se normaliza a formato internacional (`+549...`) y se guarda también en el perfil.

## Modelo de datos

### User
```json
{
  "email": "string (único)",
  "password": "string (hash bcrypt)",
  "role": "minorista | mayorista | admin",
  "name": "string",
  "phone": "string",
  "isActive": "boolean"
}
```

### Product
```json
{
  "name": "Clay Lub",
  "description": "Limpiador...",
  "image": "1683674674108-Clay-Lub.png",
  "price": 4300,
  "precioMayorista": 3500,
  "stock": 3,
  "capacity": "600ml",
  "category": "Línea Profesional",
  "brand": "Toxic-Shine"
}
```

### Brand / Category
```json
{
  "name": "string (único)",
  "slug": "string (único, derivado del nombre)",
  "isActive": "boolean",
  "sortOrder": "number",
  "description": "string",
  "image": "string (vacío o URL http(s), máx. 2048)",
  "showOnHome": "boolean (default false)"
}
```

### Cart / Favorite
```json
{
  "userId": "ObjectId",
  "products": [{ "product": "ObjectId", "quantity": "number (solo Cart)" }]
}
```

### Order
```json
{
  "numeroPedido": "number",
  "usuario": "ObjectId",
  "productos": [{ "producto": "ObjectId", "nombre": "string", "cantidad": "number", "precio": "number" }],
  "total": "number",
  "estado": "Pendiente | Completado | Cancelado",
  "telefono": "string"
}
```

`precio` es el precio unitario al momento del pedido según el rol. Los pedidos viejos pueden no tener `producto`, `precio` ni `total`.

## Seguridad

- **Helmet**: headers de seguridad HTTP
- **Rate limiting** (solo en rutas sensibles, por IP cada 15 min): login 10 intentos fallidos, refresh/logout 300, registro/recuperación/reset 30, envío de mails de recuperación 5, mails enviados por admins 30
- **Input sanitization**: sanitización de queries en los find/update
- **Password hashing**: bcryptjs con 12 salt rounds
- **JWT**: access token corto y refresh token rotativo (se guarda solo su hash)

## Deployment

### Netlify (Functions)

La app de Express corre como una única Netlify Function (`netlify/functions/api.js`, configurada en `netlify.toml`). No hay un servidor encendido: cada instancia abre la conexión a MongoDB en su primer request y la reutiliza mientras sigue viva (`src/db.js`). Si MongoDB no responde, la función contesta `503` con `code: DB_UNAVAILABLE`. Netlify solo publica `netlify/static` (un `robots.txt` que pide no indexar la API). Las imágenes de productos, marcas y categorías se cargan como links externos; el backend no sirve imágenes.

1. En Netlify, importar el repo. El build lo toma de `netlify.toml`.
2. Cargar las variables en *Site configuration → Environment variables*:
   - `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS` y las `SMTP_*`
   - `TRUST_PROXY=1` (respaldo: la IP del cliente sale del header `x-nf-client-connection-ip` de Netlify y, si falta, de `X-Forwarded-For`)
   - `MONGO_MAX_POOL_SIZE=5` (cada instancia abre su propio pool)
3. En MongoDB Atlas, permitir el acceso desde cualquier IP (`0.0.0.0/0`): las funciones no tienen IP fija.
4. En el front, apuntar `VITE_API_URL` a la URL del sitio de Netlify.

Límites a tener en cuenta: cada request tiene hasta 60 segundos y un body de hasta 6 MB (≈4,5 MB para archivos, que viajan en Base64). Los límites del rate limiting se cuentan por IP de cliente, pero cada instancia lleva su propia cuenta, así que son aproximados. Las respuestas binarias (el export de Excel) viajan en Base64: un tipo binario nuevo se agrega a `BINARY_CONTENT_TYPES` en `src/netlify-handler.js`. El plan gratis tiene un tope de créditos por mes: cada deploy a producción consume créditos, los deploy previews no.

Para probarlo en local con la CLI: `netlify dev`.

### Docker

También hay un `Dockerfile` (Node 20 + pnpm) para correrlo como servidor:

```bash
docker build -t visual-detail-backend .
docker run -p 5000:5000 --env-file .env visual-detail-backend

# Variables necesarias
# NODE_ENV=production, MONGODB_URI, JWT_SECRET, FRONTEND_URL
```

**Índices y numeración de pedidos**: antes de desplegar, correr `MONGODB_URI="<prod>" pnpm check:integrity` (dry-run). Sin duplicados: desplegar y después `pnpm check:integrity -- --apply` (o dejar que autoIndex construya los índices). Con duplicados: frenar y decidir qué hacer con ellos; el script no los toca. Al arrancar, el servidor siembra el contador de `numeroPedido` con el pedido más alto (idempotente). En Netlify no hay arranque: el primer pedido siembra el contador si falta.

**Home desde la base (marcas/categorías con `image` y `showOnHome`)**: desplegar primero el backend, después correr `pnpm backfill:home -- --apply` contra producción (conviene revisar antes el dry-run) y recién entonces desplegar el front, que lee `?home=true`.
