# Tasks: mejorar-seguridad-arquitectura-backend

## Phase 1: Infrastructure & Configuration

- [x] 1.1 Install dependencies: helmet, express-rate-limit, convict
- [x] 1.2 Create `config/index.js` con schema de convict para variables de entorno
- [x] 1.3 Create `config/default.json` con valores por defecto
- [x] 1.4 Update `.env-example` con todas las variables requeridas
- [x] 1.5 Create `utils/response-formatter.js` con helper success/error
- [x] 1.6 Create `utils/query-sanitizer.js` con funciones de sanitización MongoDB

## Phase 2: Middlewares de Seguridad

- [x] 2.1 Create `middlewares/rate-limiter.js` con configuración de rate limiting
- [x] 2.2 Create `middlewares/error.middleware.js` con manejo centralizado de errores
- [x] 2.3 Modify `index.js` agregar helmet, rate-limit, error middleware
- [x] 2.4 Modify `index.js` agregar config validation al startup
- [x] 2.5 Modify `index.js` agregar retry logic en mongoose.connect

## Phase 3: Service Layer

- [x] 3.1 Create `services/auth.service.js` (login, register, refresh, logout)
- [x] 3.2 Create `services/user.service.js` (findByEmail, findById, create, update, delete)
- [x] 3.3 Create `services/product.service.js` (findAll, findById, create, update, delete)
- [x] 3.4 Create `services/pedido.service.js` (findAll, findById, create, update)
- [x] 3.5 Modify `models/User.js` agregar campo refreshToken y métodos associated

## Phase 4: Controllers Update

- [x] 4.1 Modify `controllers/auth.controller.js` delegar a auth.service
- [x] 4.2 Modify `controllers/users.controller.js` delegar a user.service
- [x] 4.3 Modify `controllers/product.controller.js` delegar a product.service
- [x] 4.4 Modify `controllers/pedidos.controller.js` delegar a pedido.service

## Phase 5: Validation en Todos los Endpoints

- [x] 5.1 Modify `routes/auth.router.js` agregar express-validator en login, forgot, reset
- [x] 5.2 Modify `routes/users.js` agregar validation en todos los endpoints
- [x] 5.3 Modify `routes/productos.js` agregar validation en todos los endpoints
- [x] 5.4 Modify `routes/pedidos.js` agregar validation en todos los endpoints
- [x] 5.5 Modify `routes/favorites.routes.js` agregar validation
- [x] 5.6 Modify `routes/cart.routes.js` agregar validation

## Phase 6: JWT Refresh Implementation

- [x] 6.1 Agregar `/refresh` endpoint en `routes/auth.router.js`
- [x] 6.2 Agregar `/logout` endpoint en `routes/auth.router.js`
- [x] 6.3 Implementar token rotation en auth.service.js

## Phase 7: Verification

- [x] 7.1 Syntax verification of all new files
- [x] 7.2 Static analysis of implementation vs specs