# Contracts

This folder contains the machine-readable API contract source of truth.

## Canonical Source

- openapi/superartillery.yaml: REST endpoints and shared DTO/message schemas.

## Generation

The root `npm run build` script regenerates contract output before compiling the workspace. To regenerate contract output without building the applications, run from the repository root:

```bash
npm run contracts:generate
```

This command also generates the shared `CONTRACT_VERSION` constant from `info.version` in the OpenAPI document into `packages/core`, which both the server and the client re-export. The client reads its own version directly from `packages/client/package.json`; no generated client-version file is needed.

This generates the shared TypeScript contract declaration in core:

- packages/core/src/contract/generated/openapi.d.ts

Core exports request and response DTO aliases from that generated declaration for both the client and server to use.

## Contract Change Policy

1. Update schemas in contracts first and increment `info.version`.
2. Regenerate the shared types with `npm run contracts:generate`.
3. Update server/client implementation where the generated types require it.
4. Run the workspace type-check and relevant tests.
5. Keep docs explanatory and link back to this folder.

## Notes

- Do not define API schemas inside route files.
- Reuse the DTO aliases exported by `@superartillery/core`; do not redeclare contract request/response shapes in the client or server.
- Do not manually edit generated `openapi.d.ts` files.