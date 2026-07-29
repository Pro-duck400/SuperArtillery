# SuperArtillery

TypeScript multiplayer artillery game with a browser client and Node.js server.

![Game Rules](img/Screenshot-rules.png)
![Gameplay](img/Screenshot-game-play.png)

## Quick Start

Prerequisites:

- Node.js 22+
- npm 10+

Install dependencies:

```bash
npm install
cd server && npm install
cd ../client && npm install
```

Run locally in two terminals:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Server: http://localhost:3000
Client: http://localhost:5173
Swagger UI: http://localhost:3000/api/swagger

## Where To Find Docs

Primary docs are in subfolders:

- [server/README.md](server/README.md): server setup, endpoints, runtime notes
- [client/README.md](client/README.md): client setup and runtime expectations
- [contracts/README.md](contracts/README.md): contract-first workflow and generation

Contract source of truth:

- [contracts/openapi/superartillery.yaml](contracts/openapi/superartillery.yaml)

Supporting docs:

- [docs/API.md](docs/API.md)
- [docs/SuperArtillery.Apple][.Basic](docs/SuperArtillery.Apple][.Basic)

## Common Commands

```bash
npm run contracts:generate
npm run contracts:check
```