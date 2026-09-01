# Product Catalog Specification

## Purpose

Display products with pricing based on the authenticated user's role.

## Requirements

### Requirement: Product model includes mayorista pricing

The system MUST store both retail and wholesale pricing for products.

The Product model SHALL include:
- price: Number (required) - retail price for minorista customers
- priceMayorista: Number (optional) - wholesale price for mayorista customers
- When priceMayorista is null, the system SHALL apply a 15% discount to price

#### Scenario: Product with both prices defined

- GIVEN a product exists with price: 100 and priceMayorista: 85
- WHEN user with role "mayorista" views the product
- THEN displayed price is 85

#### Scenario: Product without priceMayorista

- GIVEN a product exists with price: 100 and priceMayorista: null
- WHEN user with role "mayorista" views the product
- THEN displayed price is 85 (100 - 15% discount)

### Requirement: Display price based on user role

The system MUST display the appropriate price based on the authenticated user's role.

#### Scenario: Minorista sees retail price

- GIVEN user is authenticated with role "minorista"
- WHEN user navigates to product catalog
- THEN all products display their regular price field

#### Scenario: Mayorista sees wholesale price

- GIVEN user is authenticated with role "mayorista"
- WHEN user navigates to product catalog
- THEN products with priceMayorista display that price
- AND products without priceMayorista display price with 15% discount

### Requirement: Product schema validation

The system MUST enforce valid pricing data in the Product model.

#### Scenario: Product price must be positive

- GIVEN a product with price: -10
- WHEN validation runs
- THEN validation fails with error indicating price must be positive

## Price Selection Logic

| User Role | Product has priceMayorista | Displayed Price |
|-----------|---------------------------|-----------------|
| minorista | any | price |
| mayorista | exists (not null) | priceMayorista |
| mayorista | null | price * 0.85 |