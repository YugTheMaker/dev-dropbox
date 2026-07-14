import { setupServer, shutdownServer } from './server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 36911;

const { server } = setupServer();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Dev Dropbox daemon running at http://127.0.0.1:${PORT}`);
});

// Handle graceful shutdowns
const handleShutdown = () => {
  console.log('Shutting down Dev Dropbox daemon...');
  server.close(() => {
    shutdownServer();
    console.log('Daemon shut down successfully.');
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
