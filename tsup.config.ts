import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
    'benchmarks/interactive-worker': 'src/benchmarks/interactive-worker.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  define: {
    'import.meta.vitest': 'undefined',
  },
  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: '',
      };
    }
    return {};
  },
});
