# Core Extraction Refactor — Plan And Progress

Working document for the refactor that extracts a transport-independent `packages/core`, enables a
fully offline "on this device" mode, and then splits the oversized classes. Update the status markers
as phases land.

Branch: `Refactor`.

## Goals

1. Extract a `core` package holding all game logic, runnable unchanged in Node and in the browser.
2. Let "on this device" games run entirely in the browser with **zero network calls** and no server
   process, by putting the same core behind a client-side gateway abstraction.
3. Break up the god classes (`GameManager`, `routes/api.ts`, `ui-manager.ts`, `main.ts`, `renderer.ts`).

## Decisions

| Decision | Choice |
| --- | --- |
| Repo layout | npm workspaces: `packages/core`, `packages/server`, `packages/client` |
| Offline fidelity | Full — offline adapter implements the same gateway interface and emits the same OpenAPI-derived message types as the remote one |
| Offline runtime | 100% in-browser; no server process, no `fetch`, no WebSocket |
| Server hot-seat | `/api/v1/hot-seat/games` removed once offline mode ships |
| Sequencing | Core extraction first, SOLID splits after |

## Testing policy

Tests broken by the refactor are **not repaired**. Instead:

1. All 158 pre-refactor test titles are archived in [test-inventory.md](test-inventory.md).
2. The phase that refactors a subject deletes its old suite and writes new tests at the level where
   the behaviour now lives.
3. Every inventory line must end marked `covered-by: <new test>` or `dropped: <reason>`.
   Unclassified lines block the final phase.

Exception: a pure fixture *field rename* is cheap enough to apply in place rather than deleting a
suite (done for `gameRules.test.ts` and `gameCleanupService.test.ts` in Phase 2).

## Phases

### Phase 0 — Test inventory — DONE
[test-inventory.md](test-inventory.md) created: 158 titles from 14 files, all unclassified.

### Phase 1 — Workspace scaffolding — DONE
- `client/` → `packages/client`, `server/` → `packages/server`, new `packages/core`.
- Contract types and `CONTRACT_VERSION` generated **only** into `packages/core/src/contract/`;
  server and client re-export from core. The four duplicated generated files were deleted.
- Server consumes core through a TypeScript **project reference** (`core/dist`). Client and both
  Vitest configs **alias** `@superartillery/core` to `core/src/index.ts`, so tests and the browser
  bundle build from core source with no prior build step.
- Core is compiled with `"lib": ["ES2022"]` and `"types": []`. This is the guard that turns any
  Node-only or DOM-only reference in core into a compile error — keep it.
- Single root lockfile; CI, `railway.toml`, `.gitignore` and READMEs updated.

### Phase 2 — De-Node the domain — DONE
`packages/server/src/{services,types,utils}` now contains no reference to `ws`, `node:*`, `crypto`,
`process.env` or `NodeJS.*` types.

- **`PlayerConnection` port** (`isOpen` / `send` / `close`) replaces `ws.WebSocket` in the domain;
  `PlayerSession.websocket` became `connection`. The ws adapter is
  `packages/server/src/transport/webSocketPlayerConnection.ts`. `server.ts` creates exactly one
  adapter per socket and stores it in `connectionMetadata`, because `disconnectPlayer` and
  `broadcastToGame` compare connections by reference identity.
- **Core crypto**, pure TypeScript, no platform ports: `sha256Hex`, `encodeBase64`, `randomBytes`,
  `randomUuid`. The only platform capability required is `globalThis.crypto.getRandomValues`, a
  standard global in both browsers and Node 19+. A port with a weaker browser implementation was
  rejected as a silent security asymmetry. `packages/core/src/crypto/crypto.test.ts` verifies parity
  with Node's `crypto`/`Buffer` using FIPS 180-4 vectors, block/padding boundaries, multi-byte and
  astral characters, and random tokens.
- `Clock`, `TimerScheduler` and an opaque `TimerHandle` are core ports; `NodeJS.Timeout` is gone.
- Origin defaults are injected via `GameManagerOptions`; only `server.ts` reads `process.env`.
- `packages/server/src/http/errorMapper.ts` replaced five duplicated status-code ternaries.
- Deleted `gameManager.test.ts` and `gameManager.integration.test.ts` (49 tests) per the testing
  policy; Phase 3 now replaces their coverage in the core `GameEngine` suite and reconciles their
  inventory entries.
- Scope change: the `Result<T>` / `GameError` migration moved from Phase 2 to Phase 3, to avoid
  churning return shapes immediately before the `GameEngine` facade rewrites those call sites.

### Phase 3 — Extract core — DONE
- Moved physics, battlefield/terrain, shot resolution, `GameRules`, `GameRepository`,
  `GameCleanupService`, `TokenService`, `InvitationService`, configuration/errors, and private game
  types into `packages/core`. Server module paths remain as thin compatibility re-exports; the
  server's `GameManager` now adapts the core `GameEngine` and keeps HTTP status mapping at the edge.
- Added `GameEngine`, `GameMessageFactory`, `Result<T>` and `GameError`. Engine operations return
  transport-neutral results and publish the existing contract messages through `PlayerConnection`.
- Removed the client's duplicate `physics.ts` and `terrain.ts`; client animation, trajectory and
  rendering now use core physics and terrain functions.
- Moved battlefield, shot resolver, game rules, cleanup, invitation and token tests to core. The
  `GameEngine` suite covers the archived lifecycle, lobby, authentication, gameplay, rematch, and
  stats scenarios from the 49 deleted `GameManager` tests; those inventory entries are reconciled.
- Fixed cleanup of games with empty lobby slots so legacy initiator/invited connections are closed.

### Phase 4 — Client transport abstraction — DONE
- Added `GameGateway` for the existing REST operations and WebSocket connect/disconnect/message push
  surface. `RemoteGameGateway` composes the existing `ApiClient` and `WebSocketClient`, including
  the current contract-version query parameter.
- `GameClient` now depends only on `GameGateway`; production create/join/hot-seat paths construct
  `RemoteGameGateway`. Session persistence and message handling are unchanged.
- Added a remote-adapter test for URL construction, message forwarding, and disconnect; updated
  `GameClient` tests to inject the gateway boundary.

### Phase 5 — Offline "on this device" — DONE
- Added `LocalGameGateway`, backed by the browser-safe core `GameEngine`. It maps gateway operations
  to engine results and fans `PlayerConnection` messages out with `queueMicrotask`; it uses no
  `fetch` or WebSocket transport.
- `createMode === 'device'` now selects the local gateway. Local creation, connection, shots, turns,
  and rematches use the same core transitions and message types as the remote path.
- Kept one server health probe on browser startup as a separate online-readiness indicator; device
  mode hides server controls and does not trigger further requests. Local game creation, connection,
  shots, turns, and rematches themselves use no `fetch` or WebSocket calls.
- Removed `/api/v1/hot-seat/games` and mode-specific counters from the OpenAPI contract; all
  on-this-device games are created in the browser. Stats now use flat `{ games, rematches }` totals
  scoped to the current server or local engine instance.

### Phase 6 — Server splits — DONE
- Split API endpoints into Health, Games, Invitations and Gameplay route modules; `routes/api.ts`
  now composes them and the shared request-logging middleware.
- Extracted `client-base-url`, `uptime`, and server-version helpers under the HTTP boundary.
- Replaced the monolithic `server.ts` with bootstrap wiring over `createHttpApp` and
  `WsConnectionHandler`; WebSocket authentication, identity-preserving connection metadata,
  message logging and disconnect handling now live in the handler.
- `GameManager` remains a small compatibility adapter over core `GameEngine`. Splitting it again
  into server-side lobby/session/gameplay/stats services would duplicate domain ownership, so the
  planned responsibility split is fulfilled by the core engine and its focused services.

### Phase 7 — Client splits — DONE
- Extracted `PendingPresentationQueue`, roster projection, direction policy, server-address policy,
  and invite-link parsing from `main.ts`; startup wiring continues to select local or remote gateways.
- Moved DOM discovery into `dom/elements.ts` and decomposed UI rendering/state into Lobby, HotSeat,
  Game, Rematch, LobbyStatus, Roster, and ServerHealth views. `UIManager` remains the callback-facing
  facade used by `main.ts`.
- Split renderer responsibilities into `TerrainRenderer`, `CastleRenderer`, `TrajectoryRenderer`,
  `WindRenderer`, and `CastleVisualState`; `Renderer` preserves the existing public drawing API.
- Moved session persistence into `SessionStore`, message-to-state handling into
  `GameMessageDispatcher`, and client callbacks into a typed event emitter. `GameClient` remains the
  facade used by the app and depends only on `GameGateway`.
- Added policy and presentation-queue unit coverage; existing client behavior suites still pass.

## Current baseline

Post-Phase 7 verification: `npm run build` succeeds; `npm test` passes 67 core + 10 server + 57
client = **134 tests**.

## Open questions

1. Offline state is lost on page refresh. Options: accept it (recommended — it matches today's
   behaviour after a server restart), or snapshot the engine to `localStorage`.

## Gotchas

- TypeScript 7 **removed** `baseUrl`; `paths` entries resolve relative to the tsconfig.
- Under npm workspaces, `allowScripts` is ignored in package manifests and must live in the **root**
  `package.json`, otherwise esbuild's postinstall stays blocked and Vite/Vitest break.
- The client tsconfig must not glob `../core/src/**/*` into `include`: that drags core's `*.test.ts`
  (which imports `node:crypto` and `Buffer` as a test oracle) into the client program and breaks
  `tsc --noEmit`. The `paths` mapping already pulls in whatever the client imports.
- `server.ts` resolves the OpenAPI document at `../../../contracts/...` from `dist` after the move.
- `vitest run` needs `--passWithNoTests` in a package that has no tests yet.
