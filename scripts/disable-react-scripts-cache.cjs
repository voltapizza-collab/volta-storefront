const fs = require("fs");
const path = require("path");

const configPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-scripts",
  "config",
  "webpack.config.js"
);

if (!fs.existsSync(configPath)) {
  process.exit(0);
}

let source = fs.readFileSync(configPath, "utf8");
const original = source;

source = source.replace(
  /cache: \{\s*type: 'filesystem',\s*version: createEnvironmentHash\(env\.raw\),\s*cacheDirectory: paths\.appWebpackCache,\s*store: 'pack',\s*buildDependencies: \{\s*defaultWebpack: \['webpack\/lib\/'\],\s*config: \[__filename\],\s*tsconfig: \[paths\.appTsConfig, paths\.appJsConfig\]\.filter\(f =>\s*fs\.existsSync\(f\)\s*\),\s*\},\s*\},/m,
  "cache: false,"
);
source = source.replace(/cacheDirectory: true,/g, "cacheDirectory: false,");

if (source !== original) {
  fs.writeFileSync(configPath, source);
}
