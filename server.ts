import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketServer } from 'socket.io';
import { setupSocketHandlers } from './src/server/socket-handler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    path: '/api/socketio',
  });

  setupSocketHandlers(io);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> InvestSovet running on http://0.0.0.0:${port}`);
    if (dev) {
      console.log(`> Local: http://localhost:${port}`);
    }
  });
});
