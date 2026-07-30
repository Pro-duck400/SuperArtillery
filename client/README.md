# SuperArtillery Client

Browser client for SuperArtillery, built with Vite and TypeScript.

This client consumes API contracts defined at:

- ../contracts/openapi/superartillery.yaml

Generated contract types used by the client are located at:

- src/ts/types/generated/openapi.d.ts

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

Default local URL:

- http://localhost:5173

## Runtime Expectations

- REST base URL is currently configured in src/ts/main.ts.
- WebSocket base URL is currently configured in src/ts/main.ts.
- Server should be running locally on port 3000 by default.

## Notes

- Do not manually edit generated contract type files.
- Update contracts first, regenerate, then update client implementation.
