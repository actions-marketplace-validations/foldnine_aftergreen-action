// Deterministic local HTTP fixture used by the conformance and entrypoint tests.
// It never contacts external hosts.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';

export function caseBody(server) {
  if (server.body_bytes !== undefined) {
    const suffix = Buffer.from(server.body_suffix ?? '', 'utf8');
    return Buffer.concat([Buffer.alloc(server.body_bytes - suffix.length, 'X'), suffix]);
  }
  return Buffer.from(server.body ?? '', 'utf8');
}

// Serves a single conformance case on 127.0.0.1. `requests` records request paths
// so tests can assert that redirect targets are never contacted.
export async function serveCase(server) {
  const requests = [];
  const sockets = new Set();
  const app = createServer((req, res) => {
    requests.push(req.url);
    let body = caseBody(server);
    const headers = { 'content-type': 'text/plain; charset=utf-8' };
    if (server.location) headers.location = server.location;
    if (server.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    headers['content-length'] = server.truncate ? body.length + 100 : body.length;
    const respond = () => {
      res.writeHead(server.status, headers);
      if (server.truncate) {
        res.write(body);
        setTimeout(() => res.socket?.destroy(), 20);
        return;
      }
      if (server.body_delay_ms) {
        res.flushHeaders();
        setTimeout(() => res.end(body), server.body_delay_ms).unref();
        return;
      }
      res.end(body);
    };
    if (server.delay_ms) setTimeout(respond, server.delay_ms).unref();
    else respond();
  });
  app.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return {
    base: `http://127.0.0.1:${app.address().port}`,
    requests,
    close: () => new Promise(resolve => {
      for (const socket of sockets) socket.destroy();
      app.close(resolve);
    })
  };
}

// An http:// base URL on 127.0.0.1 where nothing is listening.
export async function unreachableBase() {
  const app = createServer();
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const { port } = app.address();
  await new Promise(resolve => app.close(resolve));
  return `http://127.0.0.1:${port}`;
}
