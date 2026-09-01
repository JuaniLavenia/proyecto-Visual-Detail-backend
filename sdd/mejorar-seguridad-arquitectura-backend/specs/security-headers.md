# Security Headers Specification

## Purpose

Headers de seguridad HTTP mediante helmet con CSP, HSTS, X-Frame-Options.

## Requirements

### Requirement: Helmet Active on All Responses

El sistema DEBE incluir headers de seguridad en TODAS las respuestas HTTP.

#### Scenario: Response includes security headers

- GIVEN request GET a /products
- WHEN devuelve respuesta JSON
- THEN incluye headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

#### Scenario: CSP header present

- GIVEN request a cualquier endpoint
- WHEN devuelve respuesta
- THEN incluye header Content-Security-Policy

### Requirement: HSTS Enabled

El sistema DEBE habilitar HTTP Strict Transport Security.

#### Scenario: HTTPS request receives HSTS

- GIVEN request por HTTPS
- WHEN devuelve respuesta
- THEN incluye header Strict-Transport-Security con max-age de al menos 1 año

#### Scenario: HSTS includes subdomains

- GIVEN configuración de HSTS
- WHEN devuelve respuesta
- THEN incluye includeSubDomains en el header