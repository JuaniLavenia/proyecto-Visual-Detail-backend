# Visual Detailing — Backend

API REST para el e-commerce de Visual Detailing. Maneja productos, usuarios, autenticación, carrito, favoritos, pedidos y más.

## Stack

| Tecnología | Propósito |
|---|---|
| **Node.js** | Runtime |
| **Express** | Framework web |
| **MongoDB + Mongoose** | Base de datos |
| **JWT** | Autenticación |
| **Bcryptjs** | Hash de contraseñas |
| **Multer** | Upload de imágenes |
| **XLSX** | Importación/exportación de productos en Excel |
| **Express-Validator** | Validación de requests |
| **Helmet + Rate-Limiter** | Seguridad |
| **Nodemailer** | Envío de emails |

## Estructura del proyecto

```
src/
├── config/
│   └── index.js          # Configuración con convict
├── controllers/          # Controladores (HTTP layer)
│   ├── auth.controller.js
│   ├── product.controller.js
│   ├── cart.controller.js
│   ├── favorites.controller.js
│   └── pedidos.controller.js
├── middleware/
│   ├── admin.middleware.js
│   ├── common.middleware.js    # Validación con express-validator
│   ├── error.middleware.js
│   └── rate-limiter.js
├── models/               # Schemas de Mongoose
│   ├── User.js
│   ├── Product.js
│   ├── Cart.js
│   ├── Favorite.js
│   └── Order.js
├── routes/               # Definición de rutas
│   ├── auth.router.js
│   ├── productos.js
│   ├── cart.routes.js
│   ├── favorites.routes.js
│   └── users.js
├── services/            # Lógica de negocio (separada de HTTP)
│   ├── auth.service.js
│   ├── product.service.js
│   ├── user.service.js
│   └── pedido.service.js
├── utils/               # Utilidades
│   ├── query-sanitizer.js     # Previene query injection
│   └── response-formatter.js  # Formato estándar de respuestas
├── app.js               # Configuración de Express
└── server.js            # Entry point
```

## Scripts

```bash
npm start       # Iniciar producción (node src/server.js)
npm run watch   # Iniciar con --watch (Node.js 18+)
npm run dev     # Iniciar con nodemon (desarrollo)
```

## Configuración

Variables de entorno en `.env` (ver `.env-example`):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/visual-detail
JWT_SECRET=tu-secret-aqui
CLIENT_URL=http://localhost:5173
```

## Formato de respuestas

Todas las respuestas siguen un formato estándar:

```json
// Éxito
{
  "success": true,
  "data": { ... },
  "message": "Producto creado"
}

// Paginado
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
```

## Endpoints principales

### Productos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/productos` | Listado con paginación |
| `GET` | `/api/productos/stats` | Estadísticas agregadas (total, en stock, sin stock, valor total) |
| `GET` | `/api/productos/:id` | Detalle de producto |
| `POST` | `/api/productos` | Crear producto (multipart) |
| `PUT` | `/api/productos/:id` | Actualizar producto |
| `DELETE` | `/api/productos/:id` | Eliminar producto |
| `GET` | `/api/productos/search/:filter` | Buscar por nombre |
| `GET` | `/api/productos/category/:filter` | Filtrar por categoría |
| `GET` | `/api/productos/brand/:filter` | Filtrar por marca |
| `GET` | `/api/productos/export` | Exportar a XLSX |
| `POST` | `/api/productos/bulk-upload` | Importar desde Excel |

### Modelo de Producto

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

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registro de usuario |
| `POST` | `/api/auth/login` | Inicio de sesión |

### Carrito

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cart/:userId` | Obtener carrito |
| `POST` | `/api/cart` | Agregar / actualizar cantidad |
| `DELETE` | `/api/cart/:userId/:productId` | Eliminar item |

### Favoritos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/favorites/:userId` | Obtener favoritos |
| `POST` | `/api/favorites` | Agregar a favoritos |
| `DELETE` | `/api/favorites/:userId/:productId` | Eliminar de favoritos |

### Pedidos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/pedidos` | Listar pedidos |
| `GET` | `/api/pedidos/:id` | Detalle de pedido |
| `POST` | `/api/pedidos` | Crear pedido |

## Modelo de datos

### User
```json
{
  "name": "string",
  "email": "string",
  "password": "string (hashed)",
  "role": "user | admin | mayorista",
  "dni": "string",
  "phone": "string",
  "address": "string"
}
```

### Cart
```json
{
  "userId": "ObjectId",
  "products": [{ "product": "ObjectId", "quantity": "number" }]
}
```

### Favorite
```json
{
  "userId": "ObjectId",
  "products": [{ "product": "ObjectId" }]
}
```

### Order
```json
{
  "usuario": "ObjectId",
  "productos": [{ "nombre": "string", "cantidad": "number" }],
  "estado": "pendiente | confirmado | enviado | completado | cancelado",
  "fecha": "Date"
}
```

## Seguridad

- **Helmet**: Headers de seguridad HTTP
- **Rate Limiter**: Protección contra DDoS/brute force (100 req/15min por IP)
- **Input Sanitization**: Query sanitization en todos los find/update
- **Password Hashing**: bcryptjs con salt rounds 10
- **JWT**: Tokens con expiración

## Deployment

El proyecto está configurado para Vercel (ver `vercel.json`) y Docker (ver `Dockerfile`).

```bash
# Docker
docker build -t visual-detail-backend .
docker run -p 5000:5000 visual-detail-backend

# Variables necesarias
# MONGODB_URI, JWT_SECRET, CLIENT_URL
```