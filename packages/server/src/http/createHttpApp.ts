import cors from 'cors';
import express, { type Express } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';
import type { GameManager } from '../services/gameManager';
import { createApiRouter } from '../routes/api';

export function createHttpApp(game: GameManager, getWebSocketCount: () => number): Express {
  const app = express();
  const openApiPath = path.resolve(__dirname, '../../../../contracts/openapi/superartillery.yaml');
  const openApiSpec = parseYaml(readFileSync(openApiPath, 'utf8'));

  app.use('/api/swagger', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(cors());
  app.use(express.json());
  app.use('/api', createApiRouter(game, getWebSocketCount));
  return app;
}