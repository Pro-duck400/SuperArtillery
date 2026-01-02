# SuperArtillery Server

WebSocket game server for SuperArtillery MVP.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Type check
npm run type-check
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
PORT=3000
NODE_ENV=development
```

## MVP Features

- WebSocket server handling 2 players
- Auto-start game when both players connect
- Message relay (fire, game_over)
- Turn management
- Simple disconnect handling

## Message Protocol

See `src/types/messages.ts` for full type definitions.

### Client → Server
- `fire`: Player fires projectile with angle and velocity
- `game_over`: Client reports game winner

### Server → Client
- `game_start`: Sent when both players connected
- `fire`: Relayed to both players
- `game_over`: Relayed to both players
