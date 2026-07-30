# SuperArtillery Server

Express and WebSocket server for SuperArtillery.

This service consumes API contracts defined at:

- ../contracts/openapi/superartillery.yaml

Generated contract types used by the server are located at:

- src/types/generated/openapi.d.ts

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

Copy .env.example to .env and configure:

```
PORT=3000
NODE_ENV=development
```

## API Surface

REST endpoints:

- GET /api/v1/health
- POST /api/v1/register
- POST /api/v1/fire

Swagger UI:

- http://localhost:3000/api/swagger

## WebSocket Messages (Server -> Client)

- game_start
- shot
- turn_change
- game_over

## Notes

- Do not manually edit generated contract type files.
- Update contracts first, regenerate, then update implementation.
