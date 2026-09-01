# Service Layer Specification

## Purpose

Separación de responsabilidades entre controllers (HTTP) y services (lógica de negocio).

## Requirements

### Requirement: Controllers Delegate to Services

El sistema DEBE mover toda la lógica de negocio a la capa de servicios.

#### Scenario: Register controller calls service

- GIVEN nueva solicitud de registro
- WHEN POST /register se ejecuta
- THEN el controller llama a UserService.create() y retorna resultado

#### Scenario: Controller only handles HTTP concerns

- GIVEN cualquier request a controller
- WHEN se procesa
- THEN el controller extrae datos, llama service, formatea respuesta (sin lógica de negocio)

### Requirement: Service Layer Structure

El sistema DEBE tener una estructura de servicios bien definida.

#### Scenario: UserService exists

- GIVEN aplicación iniciando
- WHEN busca servicios
- THEN existe UserService con métodos: create, findByEmail, update, delete

#### Scenario: ProductService exists

- GIVEN aplicación iniciando
- WHEN busca servicios
- THEN existe ProductService con métodos: create, findAll, findById, update, delete

### Requirement: Services Use Models

El sistema DEBE usar modelos Mongoose desde los servicios.

#### Scenario: Service creates document

- GIVEN datos válidos para crear usuario
- WHEN UserService.create() se ejecuta
- THEN crea documento en MongoDB usando modelo User