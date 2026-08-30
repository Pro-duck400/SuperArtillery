# Private Invite Games Without Persistence

## Goal

Allow one player to create a private two-player game and invite an opponent with a shareable link or short code.

The server must support multiple simultaneous games, but **must not persist any application data**. Games, invitations, player sessions, and WebSocket state exist only in server memory.

## Explicit Constraints

- No database.
- No Redis or external session store.
- No email integration or email-related configuration.
- No game history, accounts, statistics, or durable invitation records.
- A server restart, crash, redeploy, or instance replacement destroys all games and invitations.
- The client must display a clear message when a game is lost because the server restarted.
- The server must run as a single active instance. Multiple instances would have separate in-memory game collections and cannot share games.

## User Flow

### Initiator

1. Player A opens the client.
2. The client wakes the server by calling the health endpoint with retry logic.
3. Player A enters a display name.
4. The client calls `POST /api/v1/games`.
5. The server creates an in-memory private game and returns a player session token, invitation link, and short invite code.
6. Player A copies the link or code and sends it to Player B by any channel.
7. Player A waits in the game lobby until Player B joins.

### Invited Player

1. Player B opens the invitation link or enters the invite code in the client.
2. The client wakes the server by calling the health endpoint with retry logic.
3. The client asks Player B for a display name.
4. The client calls `POST /api/v1/invitations/accept` with the invitation token or code.
5. The server marks the invitation as accepted and returns Player B's session token.
6. Both clients open authenticated WebSocket connections for the same game.
7. The server starts the game after both players are connected.

## In-Memory Domain Model

Use a `Map<string, PrivateGame>` owned by the server process.

```text
PrivateGame
  id: string
  status: pending | active | finished | expired
  createdAt: number
  expiresAt: number
  initiator:
    name: string
    sessionTokenHash: string
    websocket: WebSocket | null
  invited:
    name: string | null
    sessionTokenHash: string | null
    websocket: WebSocket | null
  game state:
    current turn
    battlefield
    game started flag
```

Do not expose session tokens or token hashes to the other player or in logs.

## API Changes

### `POST /api/v1/games`

Creates a private game.

Request:

```json
{
  "playerName": "Alice"
}
```

Response:

```json
{
  "gameId": "opaque-game-id",
  "playerToken": "opaque-player-token",
  "inviteUrl": "https://example.github.io/SuperArtillery/?invite=opaque-invite-token",
  "inviteCode": "K7M4Q2"
}
```

Requirements:

- Validate and normalize the player name.
- Generate game, invitation, and session values with a cryptographically secure random generator.
- Store only a hash of invitation and session tokens in memory.
- Set an invitation expiration time, for example 30 minutes.
- Return the link and code to the initiator so they can share them manually.

### `POST /api/v1/invitations/accept`

Accepts an invitation.

Request:

```json
{
  "inviteToken": "opaque-invite-token",
  "inviteCode": "K7M4Q2",
  "playerName": "Bob"
}
```

Response:

```json
{
  "gameId": "opaque-game-id",
  "playerToken": "opaque-player-token"
}
```

Requirements:

- Accept either the full invitation token from the link or the short invite code.
- Hash the supplied token and locate the matching in-memory invitation.
- Reject missing, expired, already accepted, or unknown invitations.
- Mark the invitation accepted before returning the response.
- Generate a separate session token for Player B.
- Never use the invitation token as the WebSocket authentication token.

### `GET /api/v1/games/:gameId/status`

Returns non-sensitive lobby state:

```json
{
  "status": "pending",
  "playersConnected": 1,
  "requiredPlayers": 2
}
```

Require a valid player session token. Do not return private player data or token values.

### `POST /api/v1/fire`

Change the existing endpoint so the player identity is taken from an authenticated session token, not from a client-supplied `playerId`.

The request may continue to contain `gameId`, `angle`, and `velocity`, but the server must verify that the token belongs to that game and derive the player ID server-side.

## WebSocket Authentication

Replace the current unauthenticated connection pattern:

```text
ws://server/?playerId=0
```

with an authenticated pattern:

```text
wss://server/?gameId=opaque-game-id&sessionToken=opaque-player-token
```

On connection, the server must:

- Validate the game ID.
- Hash and validate the session token.
- Derive the player ID from the stored session.
- Reject tokens belonging to another game.
- Reject expired, finished, or unknown games.
- Replace an existing connection for the same player safely, or reject the new connection according to the reconnection policy.

Never trust `playerId` from the query string.

## Cold Start and Server Sleep

A normal request to the hosted server should wake a sleeping Render instance. The client must not assume the first request is fast.

Implement a reusable server readiness check:

- Call `GET /api/v1/health` before create-game or accept-invitation operations.
- Retry failed or timed-out requests with delays such as 0, 1, 2, and 5 seconds.
- Show `Waking server...` while retries are in progress.
- Show a retry action after the final failure.
- Use request timeouts so the UI does not wait indefinitely.

With no persistence, sleep is acceptable only while the same process remains alive. A restart or replacement loses all in-memory state, including games whose links or codes were already shared.

## Invite Link and Code

The server must return both a full link and a short code. The initiator can use whichever is convenient.

- The full link contains a high-entropy, one-time invitation token.
- The short code is easy to type and should be scoped to the active in-memory invitation.
- The code must be sufficiently random and rate-limited to prevent guessing.
- Both forms expire at the same time and may be accepted only once.
- The client should provide a copy button and display the expiration time.
- The server must not reveal whether a guessed code is close to a valid code.
- Do not log invitation tokens, session tokens, or full invitation URLs.

## Lifecycle and Cleanup

Because there is no persistence, memory must be actively bounded.

- Expire pending invitations after the configured TTL.
- Remove expired games from the `Map`.
- Remove finished games after a short grace period.
- End a pending game when the initiator disconnects, or define and test a short reconnect window.
- Reject new games when an in-memory maximum is reached.
- Add periodic cleanup with `setInterval`.
- Clear cleanup timers during graceful shutdown where practical.

Suggested initial limits:

```text
Invitation TTL: 30 minutes
Reconnect grace period: 2 minutes
Maximum active games: 100
Finished-game retention: 5 minutes
```

These are runtime limits, not durable guarantees.

## Security Requirements

- Use `crypto.randomBytes` or `crypto.randomUUID` for opaque identifiers and tokens.
- Store only token hashes in memory.
- Use HTTPS and WSS in production.
- Restrict CORS to the deployed client origin instead of allowing every origin.
- Rate-limit game creation and invitation acceptance, especially short-code attempts.
- Prevent the same invitation from being accepted twice.
- Do not reveal whether an arbitrary invite code is valid beyond a generic acceptance response.
- Validate all game actions on the server.
- Do not trust game ID, player ID, winner, turn, angle, or velocity values from the client without validation.
- Avoid logging secrets and personally identifiable information.

## Testing Requirements

### Unit tests

- Creates a game with two empty player slots.
- Generates unique opaque game and invitation tokens and a short invite code.
- Accepts a valid invitation once.
- Rejects an unknown invitation.
- Rejects an expired invitation.
- Rejects a second acceptance of the same invitation.
- Rejects a token for a different game.
- Expires and removes games from memory.
- Enforces the maximum active-game limit.
- Derives player identity from session token.

### Integration tests

- Player A creates a game.
- Player B accepts the invitation link or code.
- Both players connect to the same game over WebSocket.
- The game starts only after both connections are ready.
- A player cannot fire in another player's game.
- A player cannot impersonate the other player by changing query parameters.
- Disconnect and reconnect behavior follows the documented policy.
- Health-check retry behavior handles a slow server startup.

### Manual acceptance test

1. Open the client in browser A.
2. Create a private game in browser A.
3. Copy the invitation link or code and open/use it in browser B or an incognito window.
4. Join with a second player name.
5. Verify both browsers show the same game and opponent.
6. Verify both players can take turns.
7. Restart the server.
8. Verify the previous invitation and game are unavailable, as required by the no-persistence constraint.

## Deployment Configuration

Railway should run one server instance with the existing build and start commands:

```text
Root directory: server
Build command: npm ci && npm run build
Start command: npm start
Health check: /api/v1/health
```

No email variables or email-provider configuration are required. The only game-related configuration is the invitation TTL and in-memory limits, which may use ordinary Railway environment variables if needed.

The GitHub Actions deployment must deploy the server and client only after the required CI checks pass. The workflow should trigger the Railway deploy.

## Out of Scope

- User accounts and login.
- Durable invitation links.
- Game history or replay storage.
- Cross-instance multiplayer.
- Matchmaking queues.
- Spectators.
- More than two players per game.
- Guaranteed recovery after server restart.

## Definition Of Done

- Multiple private two-player games can exist concurrently in one server process.
- A player can create a game and copy an invitation link or short code.
- An invited player can join through a one-time link.
- Only the two invited players can connect to and act in the game.
- Player identity is derived from server-side session tokens.
- Games and invitations expire and are removed from memory.
- Cold-start retries provide usable feedback.
- No database, Redis, file storage, or other persistence is introduced.
- Server and client tests cover invitation, authentication, expiry, isolation, and restart-loss behavior.
