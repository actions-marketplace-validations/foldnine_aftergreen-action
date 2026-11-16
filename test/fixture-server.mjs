// Fixed local endpoint for the CI smoke tests of the Action itself.
//   /       -> 200 "version=aftergreen-smoke"
//   /old    -> 200 "version=previous-build"
import { createServer } from 'node:http';
const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end(request.url === '/old' ? 'version=previous-build\n' : 'version=aftergreen-smoke\n');
});
server.listen(8765, '127.0.0.1', () => console.log('Fixture server ready'));
