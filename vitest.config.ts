import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.{test,spec}.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.{test,spec}.{ts,tsx}']
    }
  },
  resolve: {
    alias: [
      {
        find: /^@chardesk\/fonts$/,
        replacement: path.resolve(import.meta.dirname, './packages/fonts/src/index.ts')
      },
      {
        find: /^@chardesk\/chargraph\/mermaid$/,
        replacement: path.resolve(
          import.meta.dirname,
          './packages/chargraph/src/mermaid.ts'
        )
      },
      {
        find: /^@chardesk\/chargraph$/,
        replacement: path.resolve(
          import.meta.dirname,
          './packages/chargraph/src/index.ts'
        )
      },
      {
        find: '@chardesk/protocol',
        replacement: path.resolve(
          import.meta.dirname,
          './packages/protocol/src/index.ts'
        )
      },
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') }
    ]
  }
});
