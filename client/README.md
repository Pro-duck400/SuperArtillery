# SuperArtillery Client

Browser client for SuperArtillery, built with Vite and TypeScript.

This client consumes API contracts defined at:

- ../contracts/openapi/superartillery.yaml

Generated contract types used by the client are located at:

- src/ts/types/generated/openapi.d.ts

## Quick Start

Prerequisites:

- Node.js 26+
- npm 10+

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

- Enter server address in the registration panel before joining.
- The client derives REST and WebSocket endpoints from this value.
- Use `http://` or `https://` URLs (example: `http://localhost:3000`).
- By default, the server address input is prefilled with `http://localhost:3000`.

## Notes

- Do not manually edit generated contract type files.
- Update contracts first, regenerate, then update client implementation.

## GitHub Pages Deployment

The repository includes `.github/workflows/deploy-client-pages.yml` to publish this client on GitHub Pages.

- Build base path is configured through `VITE_BASE_PATH` in `vite.config.ts`.
- The workflow sets `VITE_BASE_PATH=/<repo-name>/` automatically.

To test a Pages-style build locally:

```bash
VITE_BASE_PATH=/SuperArtillery/ npm run build
```

After deployment, open your Pages URL and enter your backend host in the registration `Server address` field.
