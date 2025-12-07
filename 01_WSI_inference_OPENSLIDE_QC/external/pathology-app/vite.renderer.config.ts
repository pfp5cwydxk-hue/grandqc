import { defineConfig } from 'vite';

// Force IPv4 host to avoid ::1 binding issues in restricted environments.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
