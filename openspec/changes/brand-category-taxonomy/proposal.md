# Proposal: Brand and category taxonomy

## Summary
The current product model stores `brand` and `category` as free-form strings, and the frontend also hardcodes the lists used in product creation and PLP filtering. This slice introduces explicit taxonomy entities, admin CRUD, public listing endpoints, and a compatibility path for product data.

## Scope
- Create `Brand` and `Category` models with slug, active flag, sort order, and metadata
- Add admin CRUD endpoints and public active-list endpoints
- Keep these entities independent of product references for the first slice
- Establish the groundwork to replace hardcoded product lists in the frontend and PLP

## Non-goals
- Full PLP configurable filters
- User CRUD and admin hardening
- Conversion of products to relational references

## Risks
- Product documents still store brand/category as strings until migration is completed.
- Existing products may reference values that do not yet exist in the new taxonomy tables.
- Admin endpoints must validate duplicates and slug stability before more integrations are built.

## Delivery mode
- Interactive SDD
- Engram + OpenSpec in parallel
- One branch per slice
