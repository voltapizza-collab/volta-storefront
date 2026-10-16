// A separate entry and output directory: the experiment never enters App routes or build/.
process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';
process.env.GENERATE_SOURCEMAP = 'false';
const path = require('path');
const fs = require('fs');
const http = require('http');
const webpack = require('webpack');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const output = path.join(root, 'build-pizza-lab');
const config = require('react-scripts/config/webpack.config')('production');
config.entry = path.join(root, 'src/experiments/pizza-lab/entry.jsx');
config.output.path = output;
config.output.publicPath = '/';
config.plugins = config.plugins.filter(plugin => !['HtmlWebpackPlugin', 'InterpolateHtmlPlugin', 'WebpackManifestPlugin', 'ESLintWebpackPlugin', 'ForkTsCheckerWebpackPlugin'].includes(plugin.constructor.name));
webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  const files = stats.compilation.entrypoints.get('main').getFiles();
  fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Volta · El obrador</title>${files.filter(file => file.endsWith('.css')).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body><div id="root"></div>${files.filter(file => file.endsWith('.js')).map(file => `<script defer src="/${file}"></script>`).join('')}</body></html>`);
  console.log(`Pizza lab built in ${output}`);
  if (process.argv.includes('--build-only')) return;
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  http.createServer((req, res) => {
    let file;
    try { file = path.resolve(output, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400); res.end(); return; }
    if (file === output) file = path.join(output, 'index.html');
    if (!file.startsWith(output + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }).listen(4175, '127.0.0.1', () => console.log('Local experiment: http://127.0.0.1:4175 (no order API)'));
});
