process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';
process.env.GENERATE_SOURCEMAP = 'false';
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const config = require('react-scripts/config/webpack.config')('production');
config.entry = path.resolve('src/pos/nativeEntry.jsx');
config.output.path = path.resolve(process.env.VOLTA_ANDROID_PROJECT || 'native/sunmi-v3', 'build/packaged/assets/pos');
config.output.publicPath = '/';
config.plugins = config.plugins.filter(p => !['HtmlWebpackPlugin','InterpolateHtmlPlugin','WebpackManifestPlugin','ESLintWebpackPlugin','ForkTsCheckerWebpackPlugin'].includes(p.constructor.name));
webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({all:false,errors:true})); process.exitCode=1; return; }
  const files = stats.compilation.entrypoints.get('main').getFiles();
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src https://geocoding-api.open-meteo.com https://api.open-meteo.com https://date.nager.at; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Volta POS</title>${files.filter(f=>f.endsWith('.css')).map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}</head><body><div id="root"></div>${files.filter(f=>f.endsWith('.js')).map(f=>`<script defer src="/${f}"></script>`).join('')}</body></html>`;
  fs.writeFileSync(path.join(config.output.path,'index.html'),html);
  console.log('POS interface packaged successfully.');
});
