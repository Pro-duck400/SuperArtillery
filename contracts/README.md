# Contracts

This folder contains the machine-readable API contract source of truth.

## Canonical Source

- openapi/superartillery.yaml: REST endpoints and shared DTO/message schemas.

## Generation

Run from repository root:

```bash
npm run contracts:generate
```

This generates TypeScript contract types for both applications:

- server/src/types/generated/openapi.d.ts
- client/src/ts/types/generated/openapi.d.ts

## Contract Change Policy

1. Update schemas in contracts first.
2. Regenerate type outputs.
3. Update server/client implementation.
4. Keep docs explanatory and link back to this folder.

## Notes

- Do not define API schemas inside route files.
- Do not manually edit generated `openapi.d.ts` files.