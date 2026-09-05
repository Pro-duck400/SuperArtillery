# Contracts

This folder contains the machine-readable API contract source of truth.

## Canonical Source

- openapi/superartillery.yaml: REST endpoints and shared DTO/message schemas.

## Generation

Both application build commands regenerate their contract types before compiling. To generate both outputs without building either application, run from the repository root:

```bash
npm run contracts:generate
```

This command also generates the client and server `CONTRACT_VERSION` constants from `info.version` in the OpenAPI document. The client reads its version directly from `client/package.json`; no generated client-version file is needed.

This generates TypeScript contract types for both applications:

- server/src/types/generated/openapi.d.ts
- client/src/ts/types/generated/openapi.d.ts

## Contract Change Policy

1. Update schemas in contracts first.
2. Update server/client implementation.
3. Run each application build; it regenerates its contract types.
4. Keep docs explanatory and link back to this folder.

## Notes

- Do not define API schemas inside route files.
- Do not manually edit generated `openapi.d.ts` files.