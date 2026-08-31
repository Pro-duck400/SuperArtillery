# OpenAPI + AsyncAPI

This folder contains formal, concise API contracts in two widely used specs:

- `openapi.yaml` for REST endpoints.
- `asyncapi.yaml` for WebSocket server events.

## Quick preview options

- OpenAPI: Swagger Editor or Redoc.
- AsyncAPI: AsyncAPI Studio.

## Online visualize and verify

- OpenAPI (`openapi.yaml`)
	- Visualize/edit immediately: https://editor.swagger.io/
	- Validate/lint: https://apitools.dev/swagger-parser/online/
	- Render docs view: https://redocly.github.io/redoc/
- AsyncAPI (`asyncapi.yaml`)
	- Visualize/validate immediately: https://studio.asyncapi.com/
	- Alternative playground: https://playground.asyncapi.io/

## Notes

- Contract follows server implementation as the source of truth.
- Canonical OpenAPI source lives at `contracts/openapi/superartillery.yaml` (not in this folder).
- WebSocket connections require both `gameId` and `sessionToken` in the query string; the server never trusts a client-supplied `playerId`.
- The legacy `POST /api/v1/register` endpoint has been removed; use `POST /api/v1/games` and `POST /api/v1/invitations/accept` instead.
