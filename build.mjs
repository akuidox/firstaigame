// Build pipeline for Grimhold.
//   node build.mjs build   -> dist/game.html   (single self-contained file, Three.js inlined)
//   node build.mjs dev     -> http://localhost:8000  (live-reloading dev server)
//
// The `build` output is what we hand to the player: one HTML file they can
// double-click. No external requests at runtime, so it also works as a
// sandboxed Artifact.

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const mode = process.argv[2] || 'build';

const HTML_HEAD = /* html */ `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>Grimhold</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
  body { font-family: 'Courier New', ui-monospace, monospace; color: #e8d9b5; }
  #game { position: fixed; inset: 0; }
  canvas { display: block; }
  /* No text selection / touch callouts while playing */
  #game, #game * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
</style>`;

const HTML_TEMPLATE = (script) => /* html */ `<!doctype html>
<html lang="en">
<head>${HTML_HEAD}</head>
<body>
  <div id="game"></div>
  <script>${script}</script>
</body>
</html>`;

const buildOptions = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  legalComments: 'none',
};

if (mode === 'build') {
  const result = await esbuild.build({
    ...buildOptions,
    minify: true,
    write: false,
  });
  const js = result.outputFiles[0].text;
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/game.html', HTML_TEMPLATE(js));
  const kb = (Buffer.byteLength(HTML_TEMPLATE(js)) / 1024).toFixed(0);
  console.log(`built dist/game.html (${kb} KB, self-contained)`);
} else if (mode === 'dev') {
  // Live-reload: esbuild serves the bundle and an SSE endpoint at /esbuild.
  const ctx = await esbuild.context({
    ...buildOptions,
    minify: false,
    sourcemap: true,
    banner: {
      js: `new EventSource('/esbuild').addEventListener('change', () => location.reload());`,
    },
    outfile: 'public/bundle.js',
  });
  await ctx.watch();
  // A tiny index.html that loads the freshly-built bundle.
  mkdirSync('public', { recursive: true });
  writeFileSync('public/index.html', HTML_TEMPLATE('') // placeholder; overwritten below
  );
  writeFileSync('public/index.html', `<!doctype html>
<html lang="en"><head>${HTML_HEAD}</head>
<body><div id="game"></div><script src="/bundle.js"></script></body></html>`);
  const { host, port } = await ctx.serve({ servedir: 'public', port: 8000 });
  console.log(`dev server: http://localhost:${port}  (host ${host})`);
} else {
  console.error(`unknown mode: ${mode} (use "build" or "dev")`);
  process.exit(1);
}
