# Implementation Plan: Private Invite Games Without Persistence

## Overview
Transform the SuperArtillery server from a single-game MVP to a multi-game system supporting private invite-only games with in-memory only persistence and automatic expiration.

**Key Constraints:**
- In-memory only (no database, Redis, or persistence)
- 30-minute invitation TTL
- 30-minute active game TTL (resets on last action/message)
- Session token-based authentication
- Player name: max 15 chars, first char must be alphanumeric
- Invite codes: 6 alphanumeric chars (user-typeable)

---

## Phase 1: Core Data Model & Token Management

### 1.1 Create New Types File: `server/src/types/private-game.ts`
Define the in-memory domain model:
```typescript
// PrivateGame domain model
// Player invitation/session record
// Game status tracking: pending | active | finished | expired
// Timestamps for expiration
// WebSocket connection storage
```

**Deliverables:**
- `PrivateGame` interface with id, status, createdAt, expiresAt
- `PlayerSession` interface with name, sessionTokenHash, websocket
- `Invitation` interface with invitationTokenHash, inviteCode, expiresAt
- Game/invitation status enums

### 1.2 Create Token Service: `server/src/services/tokenService.ts`
Cryptographic token generation and validation:

**Functions:**
- `generateGameId()` → opaque string using `crypto.randomBytes`
- `generateSessionToken()` → opaque string (high entropy)
- `generateInviteCode()` → 6-char alphanumeric (user-typeable)
- `generateInviteToken()` → opaque string from link
- `hashToken(token: string)` → secure hash for storage only
- `verifyToken(plain: string, hash: string)` → boolean

**Deliverables:**
- Utility functions using Node.js `crypto` module
- Hash function (SHA-256 or bcrypt)
- No token values logged; only hashes stored in memory

---

## Phase 2: Game Management Service Refactor

### 2.1 Refactor `server/src/services/gameManager.ts`
Replace single-game MVP with multi-game manager:

**Changes:**
- Replace single player arrays with `Map<gameId, PrivateGame>`
- Implement `createGame(playerName)` → returns gameId, sessionToken, inviteUrl, inviteCode
- Implement `acceptInvitation(inviteTokenOrCode, playerName)` → returns gameId, sessionToken
- Implement `getGameStatus(gameId)` → returns pending | active | finished (no private data)
- Implement `connectPlayer(gameId, sessionToken, ws)` → authenticate & connect
- Implement `getPlayerIdFromToken(gameId, sessionToken)` → server-side player derivation
- Implement `handleDisconnect(gameId, playerId)` → cleanup or end game
- Validate player names (15 chars max, first char alphanumeric)

**Deliverables:**
- Multi-game `Map` structure
- Game creation with both tokens and codes
- One-time invitation acceptance
- WebSocket authentication via session tokens
- Game lifecycle management

### 2.2 Implement Expiration & Cleanup
Add periodic cleanup timer:

**Features:**
- Expire pending invitations after 30 minutes
- Expire active games if no activity for 30 minutes
- Remove expired games from memory
- Remove finished games after 5-minute grace period
- Enforce max 100 active games (reject new ones when full)
- Clear timers on graceful shutdown

**Deliverables:**
- `setInterval` cleanup loop (every 1 minute)
- Activity tracking per game (update on messages/actions)
- Graceful shutdown handler

---

## Phase 3: API Endpoints

### 3.1 Update `server/src/routes/api.ts`

#### New Endpoints:

**`POST /api/v1/games`** - Create a private game
- Request: `{ playerName: string }`
- Response: `{ gameId, playerToken, inviteUrl, inviteCode }`
- Validate player name (15 chars, alphanumeric first char)
- Generate all tokens and codes
- Store only hashes in memory
- Return full tokens to initiator only

**`POST /api/v1/invitations/accept`** - Accept an invitation
- Request: `{ inviteToken?: string, inviteCode?: string, playerName: string }`
- Response: `{ gameId, playerToken }`
- Accept either full token or short code
- Validate not expired, not already accepted
- Generate separate session token for Player B
- Return tokens to invited player

**`GET /api/v1/games/:gameId/status`** - Get lobby state
- Require valid session token (query param or header)
- Response: `{ status: "pending" | "active" | "finished", playersConnected: number, requiredPlayers: 2 }`
- No private player data or token values
- Check game exists and player token is valid

**Enhanced `GET /api/v1/health`**
- Add `gameCount` (active games)
- Add `invitationCount` (pending invitations)
- Add `maxGamesReached: boolean`
- Show server is ready and accepting connections

#### Modified Endpoints:

**`POST /api/v1/fire`** - Update for session tokens
- Remove client-supplied `playerId`
- Require session token (header or query param)
- Server derives `playerId` from token hash lookup
- Validate token belongs to game
- Block cross-game impersonation attempts

---

## Phase 4: WebSocket Authentication

### 4.1 Update `server/src/server.ts`

**Replace unauthenticated pattern:**
```
ws://server/?playerId=0
```

**With authenticated pattern:**
```
wss://server/?gameId=XXX&sessionToken=YYY
```

**Connection handler changes:**
- Parse `gameId` and `sessionToken` from query params
- Hash the session token
- Look up game and validate token
- Derive `playerId` from stored session
- Reject: expired games, unknown tokens, wrong game tokens, finished/unknown games
- Handle reconnection: replace existing connection or reject based on policy

**Deliverables:**
- Session token validation on WebSocket handshake
- Never trust `playerId` from query string
- Secure error messages (don't reveal why token was invalid)

---

## Phase 5: Client Integration

### 5.1 Update `client/src/ts/main.ts`

**New flow:**
1. Display "Waking server..." message
2. Call `GET /api/v1/health` with retry logic (0, 1, 2, 5 seconds)
3. Show "Create Game" or "Join with Code" UI
4. For create: call `POST /api/v1/games` with player name
5. For join: accept invite link param or ask for code, call `POST /api/v1/invitations/accept`
6. Store `gameId` and `sessionToken` in session
7. Poll `GET /api/v1/games/:gameId/status` until `playersConnected === 2`
8. Connect WebSocket with `gameId` and `sessionToken`

**Health check retry logic:**
```
Delay sequence: 0, 1, 2, 5 seconds
Show "Waking server..." during retries
Show "Server unavailable. Retry?" after final failure
Handle timeouts (e.g., 5 seconds per request)
```

**Error messages (helpful, explanatory):**
- "Game not found or expired"
- "Invitation expired. Create a new game."
- "Invitation already accepted"
- "Player name taken in this game"
- "Session expired. Restart the game."

### 5.2 Update `client/src/ts/network/websocket.ts`
- Add `gameId` and `sessionToken` to WebSocket URL
- Handle server restart detection (connection refused → show message)
- Reconnect logic with session token validation

### 5.3 Update `client/src/ts/ui-manager.ts`
- Display invite link with copy button
- Display 6-char invite code
- Show expiration time (30 minutes from creation)
- Display opponent name when joined
- Show "Server restarted. Game lost. Create a new game?" if reconnect fails

---

## Phase 6: Testing

### Unit Tests: `server/src/services/*.test.ts`

**GameManager tests:**
- ✓ Creates a game with two empty player slots
- ✓ Generates unique gameId, sessionTokens, inviteCode
- ✓ Accepts a valid invitation once
- ✓ Rejects unknown invitation
- ✓ Rejects expired invitation
- ✓ Rejects second acceptance of same invitation
- ✓ Rejects token for different game
- ✓ Expires and removes games from memory
- ✓ Enforces max 100 active games
- ✓ Derives playerID from session token

**TokenService tests:**
- ✓ Generates random tokens
- ✓ Generates 6-char alphanumeric codes
- ✓ Hashes tokens consistently
- ✓ Verifies token-to-hash matches
- ✓ Rejects mismatched tokens

**Validation tests:**
- ✓ Accepts valid player names (15 chars, alphanumeric start)
- ✓ Rejects invalid names (too long, non-alphanumeric start, empty)

### Integration Tests: `server/src/routes/*.test.ts`

**API flow tests:**
- ✓ Player A creates a game
- ✓ Player B accepts invitation via link token
- ✓ Player B accepts invitation via short code
- ✓ Both players connect to WebSocket successfully
- ✓ Game starts only after both connections
- ✓ Player cannot fire in another player's game
- ✓ Player cannot impersonate other player by changing query params
- ✓ Disconnect/reconnect follows policy
- ✓ Health check retries work
- ✓ Invitation and game expiration works

### Manual Acceptance Test

**Scenario:**
1. Open client in browser A (https://alkoz-lab.github.io/SuperArtillery/)
2. Create private game with name "Alice"
3. Copy invite link or code
4. Open link or code in browser B (incognito)
5. Join as "Bob"
6. Verify both browsers show same game and opponent names
7. Verify both players can take turns (fire)
8. Restart server
9. Verify previous invitation/game unavailable and show helpful message

---

## Phase 7: Deployment & Configuration

### GitHub Actions
- Add `RAILWAY_DEPLOY_HOOK` secret
- Trigger Railway deploy only after CI checks pass

### Railway Environment
- Set health check to `/api/v1/health`
- Optional: configure invitation TTL and max games via env vars

---

## Implementation Order (Recommended)

1. **Phase 1** - Token & type definitions (foundation)
2. **Phase 2** - GameManager refactor (core logic)
3. **Phase 3** - API endpoints (contract with client)
4. **Phase 4** - WebSocket auth (secure connections)
5. **Phase 5** - Client integration (end-to-end flow)
6. **Phase 6** - Testing (validation & regression)
7. **Phase 7** - Deployment (production ready)

---

## Security Checklist

- [ ] Use `crypto.randomBytes` for all tokens
- [ ] Store only token hashes in memory
- [ ] HTTPS & WSS in production
- [ ] CORS restricted to `https://alkoz-lab.github.io`
- [ ] Rate-limit game creation & invitation acceptance (prevent brute-force)
- [ ] Never accept same invitation twice
- [ ] Don't reveal if code is "close" to valid
- [ ] Validate all game actions server-side (angle, velocity, playerId)
- [ ] No secrets in logs or error messages
- [ ] Session token tied to specific game (cross-game rejection)
- [ ] WebSocket requires valid gameId + sessionToken pair

---

## File Structure Summary

```
server/
  src/
    services/
      gameManager.ts       [REFACTOR] Multi-game support
      tokenService.ts      [NEW] Token generation & hashing
    routes/
      api.ts               [UPDATE] New endpoints, session auth
    types/
      private-game.ts      [NEW] PrivateGame, Invitation, PlayerSession
      messages.ts          [REVIEW] May need updates for new messages
    server.ts              [UPDATE] WebSocket auth, session token validation
    __tests__/             [NEW] Unit & integration tests

client/
  src/
    ts/
      main.ts              [UPDATE] Game creation/join flow
      ui-manager.ts        [UPDATE] Invite display, error messages
      network/
        api.ts             [UPDATE] New API calls
        websocket.ts       [UPDATE] Session token auth
```

---

## Success Criteria (Definition of Done)

- ✓ Multiple private two-player games concurrent in one process
- ✓ Player can create game + copy invite link or code
- ✓ Invited player can join via one-time link
- ✓ Only two invited players can connect to/act in game
- ✓ Player identity from server-side session tokens
- ✓ Games/invitations expire & removed from memory
- ✓ Cold-start retries show "Waking server..." feedback
- ✓ No database, Redis, or persistence
- ✓ Unit & integration tests pass
- ✓ Manual acceptance test passes
- ✓ Graceful server restart message shown
