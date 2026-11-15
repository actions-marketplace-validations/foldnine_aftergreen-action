import { createServer } from 'node:http';
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('version=aftergreen-smoke\n');
});
server.listen(8765, '127.0.0.1', () => console.log('Fixture server ready'));
