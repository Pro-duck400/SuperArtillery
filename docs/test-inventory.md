# Test inventory (pre-refactor coverage contract)

Captured before the core-extraction refactor. Old tests are **not** repaired when the refactor breaks
them — the suite is deleted in the phase that refactors its subject, and new tests are written at the
level where the behaviour now lives. Every line below must end marked either:

- `covered-by: <new test file :: test name>`
- `dropped: <one-line reason>`

Unclassified lines block the final phase.

Legend for the status column: `[ ]` unclassified · `[x]` covered · `[-]` intentionally dropped.

---

## server/src/tests/api.routes.test.ts — `API routes`

- [ ] creates a game and returns invite details
- [ ] creates a hot-seat game with credentials for both players
- [ ] creates a hot-seat game with up to 9 players
- [ ] accepts an invitation by code
- [ ] requires a session token for status polling
- [ ] returns status for a valid session token
- [ ] rejects a rematch request before the game has finished
- [ ] requires a session token for rematch requests
- [ ] rejects fire without required payload fields
- [ ] reports lightweight health without totals
- [ ] reports stats including webSockets and lifetime totals

## server/src/tests/battlefield.test.ts — `battlefield generation`

> Moved to `packages/core`; assertions now use core module imports and strict optional access.

- [x] reproduces the same battlefield for the same seed — covered-by: packages/core/src/utils/battlefield.test.ts :: reproduces the same battlefield for the same seed
- [x] places castles on opposite sides and on the terrain surface — covered-by: packages/core/src/utils/battlefield.test.ts :: places castles on opposite sides and on the terrain surface
- [x] generates bounded terrain between the castles — covered-by: packages/core/src/utils/battlefield.test.ts :: generates bounded terrain between the castles
- [x] generates deterministic wind within the supported range — covered-by: packages/core/src/utils/battlefield.test.ts :: generates deterministic wind within the supported range
- [x] generates independent side elevations and bounded middle terrain — covered-by: packages/core/src/utils/battlefield.test.ts :: generates independent side elevations and bounded middle terrain
- [x] can generate both a crest and a depression from different seeds — covered-by: packages/core/src/utils/battlefield.test.ts :: can generate both a crest and a depression from different seeds

## server/src/tests/gameCleanupService.test.ts — `GameCleanupService`

> Kept in Phase 2, then moved into `packages/core` with the owning rules implementation in Phase 3.

- [x] removes an expired pending game and closes its sockets — covered-by: packages/core/src/services/gameCleanupService.test.ts :: removes an expired pending game and closes its connections
- [x] marks an inactive active game expired without deleting it before its expiry — covered-by: packages/core/src/services/gameCleanupService.test.ts :: marks an inactive active game expired without deleting it before its expiry
- [x] removes a finished game after its grace period — covered-by: packages/core/src/services/gameCleanupService.test.ts :: removes a finished game after its grace period
- [x] does not remove a game at the exact expiration boundary — covered-by: packages/core/src/services/gameCleanupService.test.ts :: does not remove a game at the exact expiration boundary

## server/src/tests/gameManager.integration.test.ts — `Integration: Private Games Flow`

> **Deleted in Phase 2** (socket mocks incompatible with the `PlayerConnection` port).
> Replacement: the `GameEngine` suite in `packages/core` (Phase 3); every scenario below is mapped
> to its replacement test.

### Full game lifecycle
- [x] Player A creates a game, Player B accepts, both connect — covered-by: packages/core/src/services/gameEngine.test.ts :: creates two empty invitation slots and issues a distinct token to the invited player
- [x] Player cannot fire in another player's game — covered-by: packages/core/src/services/gameEngine.test.ts :: scopes session tokens to a game and supports status before connecting
- [x] Player cannot impersonate other player by changing tokens — covered-by: packages/core/src/services/gameEngine.test.ts :: scopes session tokens to a game and supports status before connecting

### Game expiration and disconnection
- [x] Pending game expires when initiator disconnects — covered-by: packages/core/src/services/gameEngine.test.ts :: expires pending and active network games when their controlling player disconnects
- [x] Active game ends when player disconnects — covered-by: packages/core/src/services/gameEngine.test.ts :: expires pending and active network games when their controlling player disconnects

### Turn-based gameplay
- [x] Only the current turn player can fire — covered-by: packages/core/src/services/gameEngine.test.ts :: validates authenticated turns, angle and velocity before broadcasting

### Cold start and server readiness
- [x] Health check returns accurate statistics — covered-by: packages/core/src/services/gameEngine.test.ts :: reports current game counts and invitation totals

### Replay and reconnection
- [x] ignores a stale socket closing after a replacement connects — covered-by: packages/core/src/services/gameEngine.test.ts :: ignores a stale connection closing after a replacement connects
- [x] Player can query game status before connecting WebSocket — covered-by: packages/core/src/services/gameEngine.test.ts :: scopes session tokens to a game and supports status before connecting

### Error cases
- [x] Helpful error when invitation expired — covered-by: packages/core/src/services/gameEngine.test.ts :: expires invitations and removes expired games through the injected scheduler
- [x] Helpful error when game unavailable — covered-by: packages/core/src/services/gameEngine.test.ts :: expires pending and active network games when their controlling player disconnects
- [x] Server reports when at max capacity — covered-by: packages/core/src/services/gameEngine.test.ts :: enforces the maximum active-game capacity

## server/src/tests/gameManager.test.ts — `GameManager`

> **Deleted in Phase 2** (socket mocks incompatible with the `PlayerConnection` port).
> Replacement: the `GameEngine` suite in `packages/core` (Phase 3); every scenario below is mapped
> to its replacement test.

### createGame
- [x] creates a game with two empty player slots — covered-by: packages/core/src/services/gameEngine.test.ts :: creates two empty invitation slots and issues a distinct token to the invited player
- [x] generates unique opaque game IDs and invitation codes — covered-by: packages/core/src/services/gameEngine.test.ts :: generates unique opaque game IDs, invite codes, and player tokens
- [x] returns invite URL and code separately — covered-by: packages/core/src/services/gameEngine.test.ts :: creates an internet game with a path-preserving invitation URL and player slots
- [x] rejects invalid player names — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown invitations and invalid names
- [x] rejects names longer than 15 characters — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown invitations and invalid names
- [x] rejects names starting with non-alphanumeric — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown invitations and invalid names

### acceptInvitation
- [x] allocates multiple lobby slots and reports readiness — covered-by: packages/core/src/services/gameEngine.test.ts :: allocates multiple invited players and rejects invite reuse
- [x] lets the creator skip a partially filled lobby and start with two players — covered-by: packages/core/src/services/gameEngine.test.ts :: allows the creator to skip waiting slots after two players connect
- [x] starts a full three-player lobby and broadcasts the roster to every socket — covered-by: packages/core/src/services/gameEngine.test.ts :: waits for every invited player, then broadcasts a full multi-player roster
- [x] accepts a valid invitation via token — covered-by: packages/core/src/services/gameEngine.test.ts :: creates two empty invitation slots and issues a distinct token to the invited player
- [x] accepts a valid invitation via code — covered-by: packages/core/src/services/gameEngine.test.ts :: allocates multiple invited players and rejects invite reuse
- [x] rejects an unknown invitation — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown invitations and invalid names
- [x] rejects a second acceptance of the same invitation — covered-by: packages/core/src/services/gameEngine.test.ts :: allocates multiple invited players and rejects invite reuse
- [x] rejects invitation with invalid player name — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown invitations and invalid names
- [x] generates separate session token for invited player — covered-by: packages/core/src/services/gameEngine.test.ts :: creates two empty invitation slots and issues a distinct token to the invited player

### getPlayerIdFromToken
- [x] derives player ID from session token — covered-by: packages/core/src/services/gameEngine.test.ts :: scopes session tokens to a game and supports status before connecting
- [x] rejects token for different game — covered-by: packages/core/src/services/gameEngine.test.ts :: scopes session tokens to a game and supports status before connecting
- [x] rejects invalid token — covered-by: packages/core/src/services/gameEngine.test.ts :: scopes session tokens to a game and supports status before connecting

### expiration and cleanup
- [x] expires pending invitations after TTL — covered-by: packages/core/src/services/gameEngine.test.ts :: expires invitations and removes expired games through the injected scheduler
- [x] removes expired games from memory — covered-by: packages/core/src/services/gameEngine.test.ts :: expires invitations and removes expired games through the injected scheduler
- [x] enforces maximum active games limit — covered-by: packages/core/src/services/gameEngine.test.ts :: enforces the maximum active-game capacity

### WebSocket connection
- [x] connects player via session token — covered-by: packages/core/src/services/gameEngine.test.ts :: waits for every invited player, then broadcasts a full multi-player roster
- [x] rejects invalid session token on WebSocket connect — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown games and invalid session tokens when connecting
- [x] rejects unknown game ID — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects unknown games and invalid session tokens when connecting

### fire action
- [x] starts a hot-seat game from one connected socket — covered-by: packages/core/src/services/gameEngine.test.ts :: creates a local game and starts it through the PlayerConnection port
- [x] starts a hot-seat game with up to 9 players from one connected socket — covered-by: packages/core/src/services/gameEngine.test.ts :: starts a nine-player hot-seat match from a single connected device
- [x] rejects hot-seat creation with fewer than 2 or more than 9 names — covered-by: packages/core/src/services/gameEngine.test.ts :: rejects internet and local games outside the supported player-count range
- [x] ends the whole match when the single hot-seat device disconnects — covered-by: packages/core/src/services/gameEngine.test.ts :: ends a hot-seat match when its single device disconnects
- [x] accepts fire with valid session token — covered-by: packages/core/src/services/gameEngine.test.ts :: broadcasts shot and turn-change messages and advances the active turn
- [x] alternates authenticated turns between both players — covered-by: packages/core/src/services/gameEngine.test.ts :: alternates authenticated turns between the local players
- [x] rejects fire with invalid session token — covered-by: packages/core/src/services/gameEngine.test.ts :: validates authenticated turns, angle and velocity before broadcasting
- [x] validates angle and velocity — covered-by: packages/core/src/services/gameEngine.test.ts :: validates authenticated turns, angle and velocity before broadcasting

### rematch action
- [x] starts a new round after both players request it — covered-by: packages/core/src/services/gameEngine.test.ts :: starts a rematch once every local player has answered
- [x] counts a hot-seat rematch under totals.device — covered-by: packages/core/src/services/gameEngine.test.ts :: retains final rematch answers in the broadcast and counts device rematches
- [x] keeps final rematch answers in the status payload before clearing the state — covered-by: packages/core/src/services/gameEngine.test.ts :: retains final rematch answers in the broadcast and counts device rematches

### game statistics
- [x] returns accurate game count — covered-by: packages/core/src/services/gameEngine.test.ts :: reports current game counts and invitation totals
- [x] counts only pending invitations — covered-by: packages/core/src/services/gameEngine.test.ts :: counts only pending games that still have invitations outstanding

## server/src/tests/gameRules.test.ts — `GameRules`

> Kept: fixtures mechanically renamed `websocket` → `connection` in Phase 2.
> Moves to `packages/core` in Phase 3 (import paths only).

- [x] starts a game when both players have open sockets — covered-by: packages/core/src/services/gameRules.test.ts :: starts a game when all non-skipped players have open connections
- [x] transitions a pending game to expired when the initiator disconnects — covered-by: packages/core/src/services/gameRules.test.ts :: expires a pending game when the initiator disconnects
- [x] finishes an active game when a player disconnects — covered-by: packages/core/src/services/gameRules.test.ts :: finishes an active game when a player disconnects
- [x] switches turns after a miss and updates activity — covered-by: packages/core/src/services/gameRules.test.ts :: switches turns after a miss and updates activity
- [x] switches back to player one after player two misses — covered-by: packages/core/src/services/gameRules.test.ts :: switches back to player one after player two misses
- [x] finishes the game after a hit without switching turns — covered-by: packages/core/src/services/gameRules.test.ts :: finishes the game after a hit without switching turns
- [x] waits for both players before starting a rematch — covered-by: packages/core/src/services/gameRules.test.ts :: waits for both players before starting a rematch
- [x] clears rematch answers when a final response declines a rematch — covered-by: packages/core/src/services/gameRules.test.ts :: clears rematch answers when a final response declines a rematch
- [x] starts a new round with only the players who stayed in when another player had enough — covered-by: packages/core/src/services/gameRules.test.ts :: starts a new round with only players who chose to stay
- [x] clears rematch readiness when a finished player disconnects — covered-by: packages/core/src/services/gameRules.test.ts :: clears rematch readiness when a finished player disconnects

## server/src/tests/invitationService.test.ts — `InvitationService`

- [x] creates an invite URL that preserves the deployment path — covered-by: packages/core/src/services/invitationService.test.ts :: creates an invite URL that preserves the deployment path
- [x] accepts an invite once and rejects reuse — covered-by: packages/core/src/services/invitationService.test.ts :: accepts an invite once and rejects reuse

## server/src/tests/shotResolver.test.ts

> Moved to `packages/core` with the owning projectile math implementation.

### calculateCastleHitTime
- [x] resolves a hit using the canonical battlefield — covered-by: packages/core/src/utils/shotResolver.test.ts :: resolves a hit using the canonical battlefield
- [x] keeps player one firing toward the left castle — covered-by: packages/core/src/utils/shotResolver.test.ts :: keeps player one firing toward the left castle
- [x] returns no collision for a projectile that falls short — covered-by: packages/core/src/utils/shotResolver.test.ts :: returns no collision for a projectile that falls short
- [x] requires the projectile to enter the central 80 percent of the castle — covered-by: packages/core/src/utils/shotResolver.test.ts :: requires the projectile to enter the central 80 percent of the castle
- [x] does not count a corner touch as a castle hit — covered-by: packages/core/src/utils/shotResolver.test.ts :: does not count a corner touch as a castle hit

### calculateCastleHits
- [x] pierces every castle in the flat trajectory before the ground stops it — covered-by: packages/core/src/utils/shotResolver.test.ts :: pierces every castle in the flat trajectory before the ground stops it

## server/src/tests/tokenService.test.ts — `TokenService`

### generateGameId
- [x] generates a valid UUID — covered-by: packages/core/src/services/tokenService.test.ts :: generates unique UUID game IDs and high-entropy session tokens
- [x] generates unique IDs — covered-by: packages/core/src/services/tokenService.test.ts :: generates unique UUID game IDs and high-entropy session tokens

### generateSessionToken
- [x] generates a high-entropy token — covered-by: packages/core/src/services/tokenService.test.ts :: generates unique UUID game IDs and high-entropy session tokens
- [x] generates unique tokens — covered-by: packages/core/src/services/tokenService.test.ts :: generates unique UUID game IDs and high-entropy session tokens

### generateInviteCode
- [x] generates a 4-character alphanumeric code — covered-by: packages/core/src/services/tokenService.test.ts :: generates typeable invite codes from uppercase letters and non-zero digits
- [x] generates unique codes — covered-by: packages/core/src/services/tokenService.test.ts :: generates typeable invite codes from uppercase letters and non-zero digits
- [x] only uses uppercase letters and numbers — covered-by: packages/core/src/services/tokenService.test.ts :: generates typeable invite codes from uppercase letters and non-zero digits

### hashToken
- [x] produces a consistent hash for the same token — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values
- [x] produces different hashes for different tokens — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values
- [x] produces hex-encoded output — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values

### verifyToken
- [x] returns true for a matching token and hash — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values
- [x] returns false for a non-matching token and hash — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values
- [x] returns false for empty token — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values
- [x] uses constant-time comparison (prevents timing attacks) — covered-by: packages/core/src/services/tokenService.test.ts :: hashes tokens consistently and verifies matching values

### validatePlayerName
- [x] accepts valid player names — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] rejects empty names — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] rejects names longer than 15 characters — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] rejects names starting with non-alphanumeric character — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] accepts names with spaces and special chars in middle — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] rejects null/undefined — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names

### normalizeName
- [x] returns trimmed name for valid names — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] returns null for invalid names — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names
- [x] rejects names exceeding 15 chars — covered-by: packages/core/src/services/tokenService.test.ts :: validates and normalizes player names

---

## client/src/tests/game-client.test.ts — `GameClient private-game flow`

- [ ] stores a create-game session and exposes it
- [ ] restores a previously saved session from storage
- [ ] returns player id from the stored session when available
- [ ] records only local player shots received from the server
- [ ] dispatches rematch readiness updates from the server
- [ ] applies consecutive turn changes for both players

## client/src/tests/game.test.ts — `Game shot history`

- [ ] keeps the four most recent shots in newest-first order
- [ ] resets the history
- [ ] keeps separate shot history for each player

## client/src/tests/projectile-animator.test.ts — `ProjectileAnimator active trajectory lifecycle`

- [ ] emits an active frame and clears it when stopped
- [ ] clears the active channel when a projectile reaches the terrain
- [ ] notifies completion separately from the active-frame clear

## client/src/tests/renderer.test.ts — `Renderer trajectory styles`

- [ ] draws historical and active trajectories with dark gray styles
- [ ] draws an active trajectory with the same dark gray color
- [ ] uses the requested historical dark gray fade steps
- [ ] applies historical opacity directly to the dark gray stroke
- [ ] draws castle emojis 2px further left and on the ground line
- [ ] replaces the defeated castle emoji with an explosion
- [ ] keeps earlier RIP castles when a later player is defeated
- [ ] chooses two different random castle emoji for each player from the approved set
- [ ] assigns a unique emoji to every local player

## client/src/tests/ui-manager.test.ts — `UIManager private game flow`

- [ ] provides editable server address choices
- [ ] shows server health details after selecting a server
- [x] checks the preselected server automatically — covered-by: packages/client/src/tests/ui-manager.test.ts :: checks the preselected server on startup without additional checks in on-device mode
- [ ] checks the current server when the refresh button is pressed
- [ ] shows a red error when the selected server health check fails
- [ ] shows Create and over Internet as the collapsed default selections
- [ ] allows creating a private game from the lobby
- [ ] creates a game after explicitly selecting Create
- [x] switches between create modes and starts hot seat on this device — covered-by: packages/client/src/tests/ui-manager.test.ts :: switches between create modes and starts hot seat on this device
- [ ] supports adding and removing hot-seat players up to a maximum of 9
- [ ] blocks names longer than 15 characters and enforces the HTML max length
- [ ] fires when Enter is pressed in the velocity input
- [ ] restores shot inputs and focuses angle on the active turn
- [ ] enforces angle and velocity limits
- [ ] changes to join mode when Join is selected
- [ ] enables joining only for populated invite-code input and hides server selection for invite links
- [ ] shows invite details after creation
- [ ] controls direction field visibility and default value
- [ ] hides lobby inputs while creating and restores them after an error
- [ ] copies the invite URL to the clipboard when the copy button is clicked
- [ ] hides invite details after a connection timeout
- [ ] updates player names and turn state correctly
- [ ] positions player names at their castle labels when coordinates are provided
- [ ] shows both player names in the game over message
- [ ] offers a rematch after game over and shows waiting state after selection
- [ ] renders angle and velocity as rows with newest-first history columns
