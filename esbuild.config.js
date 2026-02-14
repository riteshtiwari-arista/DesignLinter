import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  platform: 'browser',
  target: 'es2017',
  format: 'iife',
  logLevel: 'info',
  supported: {
    'object-rest-spread': true
  }
}).catch(() => process.exit(1));
