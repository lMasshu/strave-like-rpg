import 'dotenv/config';
import { buildApp } from './infrastructure/http/app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const app = await buildApp();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Stride Quest API REST running on ${address}`);
    console.log(`📋 Healthcheck: ${address}/health`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
