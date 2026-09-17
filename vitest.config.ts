import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{shared,backend,frontend}/src/**/*.test.ts'],
  },
});
