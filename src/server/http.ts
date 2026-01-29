import express, { type Express } from 'express';
import { createServer, type Server } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Config } from '../config/schema.js';
import { WSHandler } from './ws-handler.js';
import { createRoutes } from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * HTTP and WebSocket server
 */

export interface ServerInstance {
  app: Express;
  httpServer: Server;
  wsHandler: WSHandler;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createAppServer(config: Config): ServerInstance {
  const app = express();
  const httpServer = createServer(app);
  const wsHandler = new WSHandler(httpServer);

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS for development
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // API routes
  const routes = createRoutes(config, wsHandler);
  app.use('/api', routes);

  // Proxy for Prefect Bridge (forwards /prefect/* to localhost:4201/*)
  const PREFECT_BRIDGE_URL = process.env.PREFECT_BRIDGE_URL || 'http://localhost:4201';
  app.use('/prefect', async (req, res) => {
    const targetUrl = `${PREFECT_BRIDGE_URL}${req.url}`;
    
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}),
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    } catch (error) {
      // Prefect Bridge is not available
      res.status(503).json({
        error: 'Prefect Bridge unavailable',
        detail: 'The Prefect Bridge server is not running',
      });
    }
  });

  // Serve static files for web UI (when built)
  const webDistPath = join(__dirname, '../../web/dist');
  app.use(express.static(webDistPath));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(join(webDistPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).json({
          message: 'Skynet API Server',
          docs: '/api/health for health check',
          webUI: 'Web UI not built yet. Run: cd web && npm run build',
        });
      }
    });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  const start = (): Promise<void> => {
    return new Promise((resolve) => {
      httpServer.listen(config.server.port, config.server.host, () => {
        console.log(`Server running at http://${config.server.host}:${config.server.port}`);
        console.log(`WebSocket available at ws://${config.server.host}:${config.server.port}/ws`);
        resolve();
      });
    });
  };

  const stop = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('Shutting down server...');
      wsHandler.close();
      httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Server stopped');
          resolve();
        }
      });
    });
  };

  return {
    app,
    httpServer,
    wsHandler,
    start,
    stop,
  };
}
