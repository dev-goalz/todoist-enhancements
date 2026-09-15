import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/** Where test/contract.test.ts listens; keep the two in step. */
const CONTRACT_PORT = 18787;

export default defineConfig({
  resolve: {
    // The contract test imports the frontend's API client, which uses this alias.
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Test files would race to create the same Postgres tables.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    env: { VITE_API_BASE: `http://127.0.0.1:${CONTRACT_PORT}/api/v1` },
  },
});
