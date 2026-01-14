# SuperArtillery - Implementation Plan

**Philosophy**: Deploy early, deploy often. Build the simplest thing first, then iterate.

---

## 🎯 Part 1: Sprint 0 - MVP (Minimal Viable Product)

### Goal: Ultra-Crude but Playable 2-Player Online Game

**Success Criteria:**
- ✅ Two players can connect from different browsers
- ✅ They take turns firing projectiles
- ✅ Projectile follows a parabolic arc
- ✅ Hit detection works (castle or ground)
- ✅ Winner is declared
- ✅ Both FE and BE are deployed to production

**Time Estimate**: 1-2 days for experienced developer, or one weekend

---

### 🔴 Critical Simplifications for MVP

#### What We're CUTTING (to be added later):
- ❌ **No terrain generation** - Just a flat horizontal line
- ❌ **No wind** - Pure gravity physics only
- ❌ **No animations** - Projectile disappears on hit (no explosion)
- ❌ **No rounds/scoring** - Game ends on first hit (one-shot game)
- ❌ **No styling/CSS** - Browser default styles only
- ❌ **No player names** - Just "Player 1" and "Player 2"
- ❌ **No lobby UI** - Auto-connect first 2 players
- ❌ **No matchmaking queue** - Server handles only ONE game at a time
- ❌ **No reconnection** - Disconnect = game over
- ❌ **No validation** - Trust client physics calculations
- ❌ **No persistence** - No database, all in-memory
- ❌ **No REST API** - Pure WebSocket communication
- ❌ **Fixed castle positions** - Always at x=20 and x=260

---

### Front-End (Ultra-Minimal)

#### File Structure
```
client/
├── src/
│   ├── index.html           # Single page with canvas and inputs
│   ├── css/
│   │   └── style.css        # Basic styling
│   ├── ts/                  # TypeScript source
│   │   ├── main.ts          # Entry point, WebSocket setup
│   │   ├── game.ts          # Game state and turn management
│   │   ├── physics.ts       # Projectile physics (gravity only)
│   │   ├── renderer.ts      # Draw canvas (flat ground, castles, projectile)
│   │   ├── terrain.ts       # Terrain generation (placeholder)
│   │   ├── network/
│   │   │   ├── websocket.ts # WebSocket client implementation
│   │   │   └── api.ts       # REST API client (placeholder)
│   │   └── types/
│   │       ├── game.ts      # Game-related types
│   │       ├── player.ts    # Player types
│   │       └── messages.ts  # WebSocket message type definitions
│   └── assets/
│       └── sounds/          # Optional sound effects (future)
├── public/                  # Static assets
├── dist/                    # Build output
├── tsconfig.json
├── vite.config.ts
└── package.json
```

#### Features Checklist

**Setup & Configuration**
- [x] Initialize Vite + TypeScript project
- [x] Basic `tsconfig.json` (strict mode)
- [x] Install dependencies: `vite`, `typescript`

**Rendering (Canvas)**
- [x] Create 280x160 canvas element
- [x] Draw flat ground (horizontal line at y=140)
- [x] Draw Player 1 castle (small rectangle at x=20, y=130-140)
- [x] Draw Player 2 castle (small rectangle at x=260, y=130-140)
- [ ] Draw projectile (2px circle) at current position
- [ ] Clear and redraw each frame (60fps)

**Physics Engine (Simplified)**
- [ ] Convert angle/velocity to vx, vy components
  - `vx = velocity * cos(angle * π/180)`
  - `vy = -velocity * sin(angle * π/180)`
- [ ] Update position each frame:
  - `x += vx * dt`
  - `y += vy * dt`
  - `vy += gravity * dt` (gravity = 600)
- [ ] No wind resistance (simplified!)

**Collision Detection**
- [ ] Check if projectile y > 140 (hit ground)
- [ ] Check if projectile within 5px of castle center (hit castle)
- [ ] Determine which castle was hit (Player 1 or Player 2)

**UI (Minimal HTML)**
- [x] Status display: "Your Turn" / "Waiting for opponent"
- [x] Angle input field (0-90)
- [x] Velocity input field (0-350)
- [x] "Fire!" button
- [ ] Message display for game over

**WebSocket Client**
- [x] Connect to WebSocket server on load
- [x] Send fire message: `{ type: "fire", angle, velocity }`
- [x] Receive game_start: `{ type: "game_start", playerId: 0|1, turn: 0|1 }`
- [x] Receive fire message from server (relay to both players)
- [ ] Receive game_over: `{ type: "game_over", winner: 0|1 }`
- [ ] Display connection status

**Game State**
- [ ] Track your player ID (0 or 1)
- [ ] Track current turn (0 or 1)
- [ ] Disable inputs when not your turn
- [ ] Enable inputs when your turn
- [ ] Reset game after winner declared

---

### Back-End (Ultra-Minimal)

#### File Structure
```
server/
├── src/
│   ├── server.ts           # Main entry, WebSocket server
│   ├── services/
│   │   └── gameManager.ts  # Single game instance manager
│   └── types/
│       └── messages.ts     # Shared message types
├── dist/                   # Build output
├── tsconfig.json
├── package.json
└── .env.example
```
x] Initialize Node.js + TypeScript project
- [x] Install dependencies: `ws`, `typescript`, `@types/ws`, `ts-node`
- [x] Configure `tsconfig.json` for Node.js
- [x] Environment variables: `PORT` (default 3000)

**WebSocket Server**
- [x] Create WebSocket server using `ws` library
- [x] Listen on port from environment (PORT=3000)
- [x] Accept connections (max 2 players)

**Connection Management**
- [x] Array to store 2 player connections
- [x] Assign player ID (0 or 1) on connection
- [x] When 2 players connected: start game
- [x] Send `game_start` to both players
- [x] Handle player disconnect (end game, reset)

**Game Logic (Minimal)**
- [x] Track current turn (0 or 1)
- [x] Relay `fire` message to both players
- [x] Switch turn after each shot
- [x] Relay `game_over` when hit detected
- [x] Reset game state after game over
- [x] Clear player array for next game

**Message Protocol**
```typescript
// Message types (shared with FE)
interface GameStartMessage {
  type: "game_start";
  playerId: 0 | 1;
  turn: 0 | 1;
}

interface FireMessage {
  type: "fire";
  angle: number;
  velocity: number;
}

interface GameOverMessage {
  type: "game_over";
  winner: 0 | 1;
}
```

**Simplifications**
- [x] Single game instance (no room system)
- [x] Server only relays messages (no validation)
- [x] Client determines hit/winner (server trusts client)
- [x] No authentication or player names
- [x] Single game instance (no room system)
- [ ] Server only relays messages (no validation)
- [ ] Client determines hit/winner (server trusts client)
- [ ] No authentication or player names
- [ ] No game state persistence

---

### Deployment

#### Front-End Deployment
- [ ] Build production bundle: `npm run build`
- [ ] Test build locally: `npm run preview`
- [ ] Deploy to **GitHub Pages**:
  - Push to GitHub
  - Enable GitHub Pages (Settings → Pages)
  - Select `dist` folder
- [ ] **OR** deploy to **Netlify**:
  - Connect GitHub repo
  - Build command: `npm run build`
  - Publish directory: `dist`
- [ ] **OR** deploy to **Vercel**:
  - Connect GitHub repo
  - Auto-detects Vite config

#### Back-End Deployment
- [ ] Create `package.json` scripts:
  ```json
  {
    "scripts": {
      "build": "tsc",
      "start": "node dist/server.js",
      "dev": "ts-node src/server.ts"
    }
  }
  ```
- [ ] Deploy to **Render**:
  - Create new Web Service
  - Connect GitHub repo
  - Build command: `npm run build`
  - Start command: `npm start`
  - Add environment variable: `PORT=10000`
- [ ] **OR** deploy to **Railway**:
  - Connect GitHub repo
  - Auto-detects Node.js
  - Add PORT variable
- [ ] Get WebSocket URL (wss://your-app.onrender.com)

#### Integration
- [ ] Update FE WebSocket URL to production BE
- [ ] Test with two browser windows/tabs
- [ ] Test from different devices/networks
- [ ] Verify end-to-end gameplay

---

### Testing Checklist

**Local Testing**
- [ ] Both players can connect
- [ ] Turn switching works correctly
- [ ] Projectile renders on both screens
- [ ] Hit detection works (ground and castle)
- [ ] Game over message displays
- [ ] Can refresh and play again

**Production Testing**
- [ ] Open two browser tabs to FE URL
- [ ] Both connect to BE successfully
- [ ] Complete full game: fire, hit, winner
- [ ] Test from different devices
- [ ] Test disconnect handling

---

### 🎉 MVP Success!

**When Sprint 0 is complete:**
- You have a working online multiplayer game
- Both FE and BE are deployed and accessible
- Two players anywhere in the world can play together
- Foundation is ready for incremental improvements

**Next**: Move to Part 2 features and break them into future sprints

---

## 📋 Part 2: Full Feature List (Post-MVP)

Comprehensive list of all features needed to build the complete SuperArtillery game. These will be organized into sprints later.

---

### 🎨 Core Game Features (Match Original 1980 Game)

#### Terrain System
- [ ] Random terrain generation using cosine curves
- [ ] Variable hill heights and positions
- [ ] Ensure playable terrain (not too steep/flat)
- [ ] Random castle placement on terrain (not in valleys)
- [ ] Terrain collision detection (projectile hits hills)

#### Physics & Ballistics
- [ ] Wind effects on projectile trajectory
  - Random wind speed (-50 to +50)
  - Wind resistance affects horizontal velocity over time
- [ ] Improved gravity simulation
- [ ] Angle validation (0-90° for player 1, mirrored for player 2)
- [ ] Velocity limit (>350 = cannon explodes, lose turn)
- [ ] Projectile arc calculation and rendering

#### Game Mechanics
- [ ] Multi-round games (best of N rounds)
- [ ] Score tracking across rounds
- [ ] Shot history (last 4 shots: angle/velocity)
- [ ] Game configuration (number of rounds, time limits)

#### Visual Feedback
- [ ] Wind indicator with animated arrow
- [ ] Projectile trail/arc line
- [ ] Explosion animation on impact
- [ ] Castle damage visualization
- [ ] Crater on terrain after explosion
- [ ] Animated cannon firing
- [ ] Smoke/particle effects

---

### 🌐 Networking & Infrastructure

#### WebSocket Features
- [ ] Reliable message delivery
- [ ] Message acknowledgment system
- [ ] Heartbeat/ping-pong (connection health check)
- [ ] Automatic reconnection on disconnect
- [ ] Game state recovery after reconnect
- [ ] Latency compensation
- [ ] Synchronized game clock between clients

#### REST API Endpoints

**Authentication**
- [ ] `POST /api/auth/register` - Create account
- [ ] `POST /api/auth/login` - Login
- [ ] `POST /api/auth/logout` - Logout
- [ ] `GET /api/auth/refresh` - Refresh JWT token
- [ ] `GET /api/auth/profile` - Get user profile

**Lobby & Matchmaking**
- [ ] `POST /api/lobby/join` - Join matchmaking queue
- [ ] `GET /api/lobby/status/:playerId` - Check queue position
- [ ] `DELETE /api/lobby/leave/:playerId` - Leave queue
- [ ] `POST /api/game/create` - Create private game
- [ ] `POST /api/game/:id/join` - Join private game with code

**Game Info**
- [ ] `GET /api/game/:id` - Get game metadata
- [ ] `GET /api/game/:id/state` - Get current game state
- [ ] `GET /api/game/:id/replay` - Get replay data
- [ ] `GET /api/games/recent` - Recent games list
- [ ] `GET /api/games/live` - Currently active games

**Statistics & Leaderboard**
- [ ] `GET /api/players/:id/stats` - Player statistics
- [ ] `GET /api/leaderboard` - Global rankings
- [ ] `GET /api/players/:id/history` - Match history
- [ ] `GET /api/players/:id/achievements` - Achievement progress

**Server Management**
- [ ] `GET /api/health` - Health check
- [ ] `GET /api/status` - Server status (player count, games)
- [ ] `GET /api/version` - API version info

---

### 👥 Multiplayer & Matchmaking

#### Matchmaking System
- [ ] Queue management (FIFO)
- [ ] Skill-based matchmaking (ELO rating)
- [ ] Queue timeout handling
- [ ] Multiple concurrent games support
- [ ] Room creation and lifecycle management
- [ ] Maximum players per room (2)
- [ ] Game session tracking

#### Player Management
- [ ] Player registration and authentication
- [ ] JWT token-based auth
- [ ] Anonymous guest play (optional)
- [ ] Player profiles
- [ ] Friend system (add/remove friends)
- [ ] Block/report players
- [ ] Player status (online, in-game, offline)

#### Game Rooms
- [ ] Public matchmaking rooms
- [ ] Private rooms with invite codes
- [ ] Room settings (rounds, time limits)
- [ ] Room chat (pre-game lobby)
- [ ] Ready check before game starts
- [ ] Spectator slots (watch games)
- [ ] Room persistence across disconnects

---

### 💾 Data Persistence & Storage

#### Database Schema
- [ ] **Users table**: id, username, email, password_hash, created_at
- [ ] **Games table**: id, player1_id, player2_id, winner_id, terrain, wind, created_at
- [ ] **Rounds table**: id, game_id, round_number, shots, winner_id
- [ ] **Stats table**: user_id, wins, losses, total_shots, accuracy, elo_rating
- [ ] **Achievements table**: user_id, achievement_id, unlocked_at

#### Database Operations
- [ ] User CRUD operations
- [ ] Game history persistence
- [ ] Statistics aggregation and updates
- [ ] Leaderboard queries with caching
- [ ] Game replay data storage
- [ ] Achievement tracking

#### Technology Options
- [ ] SQLite (simple, file-based)
- [ ] PostgreSQL (production-ready)
- [ ] MongoDB (NoSQL option)
- [ ] Redis (caching and sessions)

---

### 🎨 UI/UX Enhancements

#### Lobby & Menus
- [ ] Main menu (Play, Stats, Settings, About)
- [ ] Matchmaking lobby with queue position
- [ ] Player name/nickname input
- [ ] Avatar selection (optional)
- [ ] Game mode selection (quick match, private, vs AI)
- [ ] Settings panel (volume, graphics quality)
- [ ] How to Play / Tutorial screen

#### In-Game UI
- [ ] Player info display (name, score)
- [ ] Current turn indicator (highlight active player)
- [ ] Input panel with validation feedback
- [ ] Shot history panel (last 4 shots)
- [ ] Wind indicator (direction and strength)
- [ ] Timer display (time remaining for turn)
- [ ] Chat panel (optional)
- [ ] Pause menu
- [ ] Surrender/forfeit button

#### Post-Game
- [ ] Game over screen with winner announcement
- [ ] Match statistics summary
- [ ] Play again button
- [ ] Return to lobby button
- [ ] Share game result (social media)
- [ ] Replay viewer

#### Visual Design
- [ ] Consistent color scheme and branding
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Loading states and spinners
- [ ] Error messages and toast notifications
- [ ] Smooth transitions and animations
- [ ] Accessibility (keyboard navigation, screen reader)
- [ ] Dark mode / Light mode toggle

---

### 🎵 Audio & Sound Effects

#### Sound Effects
- [ ] Cannon fire sound
- [ ] Projectile whistle/whoosh
- [ ] Explosion on impact
- [ ] Castle hit sound
- [ ] Terrain hit sound
- [ ] Turn change notification
- [ ] Victory fanfare
- [ ] Defeat sound
- [ ] UI click/hover sounds
- [ ] Menu navigation sounds

#### Audio System
- [ ] Sound library integration (Howler.js)
- [ ] Volume controls (master, SFX, music)
- [ ] Mute toggle
- [ ] Audio preloading
- [ ] Browser autoplay policy handling
- [ ] Background music (optional)
- [ ] Positional audio (left/right castle)

---

### 🧪 Testing & Quality Assurance

#### Unit Tests
- [ ] Physics calculations (trajectory, collision)
- [ ] Game state management
- [ ] Input validation
- [ ] Utility functions
- [ ] API endpoint handlers
- [ ] Database operations

#### Integration Tests
- [ ] WebSocket message flow
- [ ] Client-server communication
- [ ] REST API endpoints
- [ ] Authentication flow
- [ ] Matchmaking system
- [ ] Game lifecycle (start to finish)

#### End-to-End Tests
- [ ] Full gameplay simulation (two players)
- [ ] Lobby to game completion flow
- [ ] Disconnection and reconnection
- [ ] Multiple concurrent games
- [ ] Cross-browser compatibility

#### Performance Testing
- [ ] Load testing (100+ concurrent players)
- [ ] WebSocket connection stress test
- [ ] Database query optimization
- [ ] Client-side FPS benchmarking
- [ ] Memory leak detection
- [ ] Network latency simulation

---

### 🔒 Security & Validation

#### Server-Side Validation
- [ ] Physics calculations verification (anti-cheat)
- [ ] Input sanitization (angle, velocity)
- [ ] Rate limiting on API endpoints
- [ ] WebSocket message rate limiting
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Session management

#### Authentication & Authorization
- [ ] Password hashing (bcrypt)
- [ ] JWT token validation
- [ ] Token expiration and refresh
- [ ] Secure password requirements
- [ ] Account verification (email)
- [ ] Password reset flow
- [ ] Two-factor authentication (optional)

#### Infrastructure Security
- [ ] HTTPS/TLS for all connections
- [ ] WSS (WebSocket Secure)
- [ ] Environment variable management
- [ ] Secret key rotation
- [ ] CORS configuration
- [ ] Helmet.js security headers
- [ ] DDoS protection

---

### 📊 Analytics & Monitoring

#### Server Monitoring
- [ ] Error logging (Winston/Pino)
- [ ] Performance metrics
- [ ] WebSocket connection count
- [ ] Active game count
- [ ] Server resource usage (CPU, memory)
- [ ] Request/response times
- [ ] Error rate tracking

#### Analytics
- [ ] Player activity tracking
- [ ] Game completion rates
- [ ] Average game duration
- [ ] Popular times/days
- [ ] Player retention metrics
- [ ] Feature usage statistics

#### Tools & Services
- [ ] Error tracking (Sentry, optional)
- [ ] Analytics dashboard
- [ ] Uptime monitoring (UptimeRobot, optional)
- [ ] Log aggregation
- [ ] APM (Application Performance Monitoring)

---

### 🚀 Advanced Features (Beyond Original)

#### AI Opponent
- [ ] Single-player mode with bot
- [ ] Difficulty levels (Easy, Medium, Hard)
- [ ] Bot physics calculation
- [ ] Strategic shot selection
- [ ] Learning AI (optional, ML-based)

#### Replay System
- [ ] Record game state each frame
- [ ] Replay viewer with playback controls
- [ ] Save favorite replays
- [ ] Share replay links
- [ ] Replay download (JSON format)

#### Tournament Mode
- [ ] Bracket generation
- [ ] Multi-round tournaments
- [ ] Leaderboard for tournament
- [ ] Prize/reward system
- [ ] Tournament scheduling

#### Custom Content
- [ ] Custom terrain editor
- [ ] Save/load custom maps
- [ ] Share custom maps with community
- [ ] User-generated content gallery
- [ ] Map rating system

#### Power-Ups & Variants
- [ ] Special ammunition types (cluster bombs, nukes)
- [ ] Temporary power-ups (double damage, wind immunity)
- [ ] Game modifiers (low gravity, extreme wind)
- [ ] Unlockable weapons
- [ ] Limited-use special abilities

#### Social Features
- [ ] In-game text chat
- [ ] Emoji/reaction system
- [ ] Friend list and online status
- [ ] Private messages
- [ ] Clan/guild system (optional)
- [ ] Social feed (recent activities)

#### Progressive Web App (PWA)
- [ ] Service worker for offline support
- [ ] App manifest
- [ ] Install prompt
- [ ] Push notifications
- [ ] Offline mode (vs AI only)

#### Mobile Optimization
- [ ] Touch controls
- [ ] Responsive canvas scaling
- [ ] Mobile-friendly UI
- [ ] Performance optimization for mobile
- [ ] Native app wrapper (optional: Capacitor)

#### Visual Themes
- [ ] Multiple visual themes (retro, modern, sci-fi)
- [ ] Customizable castle appearances
- [ ] Particle effect styles
- [ ] Environment variants (desert, snow, etc.)
- [ ] Seasonal themes

#### Achievements & Progression
- [ ] Achievement system
- [ ] Badges and titles
- [ ] Experience points (XP)
- [ ] Level progression
- [ ] Unlockable cosmetics
- [ ] Daily challenges
- [ ] Weekly quests

---

### 🛠️ Developer Tools & DevOps

#### Development Environment
- [ ] Hot module replacement (HMR)
- [ ] TypeScript strict mode
- [ ] ESLint configuration
- [ ] Prettier code formatting
- [ ] Pre-commit hooks (Husky)
- [ ] VSCode workspace settings

#### Build & Deployment
- [ ] Production build optimization
- [ ] Code minification and tree-shaking
- [ ] Asset compression (images, audio)
- [ ] CDN integration for static assets
- [ ] Environment-based configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated testing in CI
- [ ] Staging environment
- [ ] Blue-green deployment

#### Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Code comments and JSDoc
- [ ] Architecture diagrams
- [ ] Deployment guide
- [ ] Contributing guidelines
- [ ] Changelog maintenance

---

## 📝 Summary

**Part 1 (Sprint 0)**: Ultra-minimal MVP with ~20 essential tasks for crude 2-player online game

**Part 2 (Post-MVP)**: ~200+ features organized into categories:
- Core game features (terrain, physics, mechanics)
- Networking infrastructure (WebSocket, REST API)
- Multiplayer systems (matchmaking, rooms)
- Data persistence (database, stats)
- UI/UX enhancements (lobby, menus, design)
- Audio system
- Testing & QA
- Security & validation
- Analytics & monitoring
- Advanced features (AI, replays, tournaments, etc.)
- Developer tools & DevOps

**Next Step**: Organize Part 2 features into logical sprints based on dependencies and priorities.

---

*This implementation plan will evolve as development progresses. Adjust priorities based on feedback and learnings from each sprint.*
