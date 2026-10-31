const { resolve } = require("node:path");

const root = resolve(__dirname, "..");

// Both apps listen only on 127.0.0.1, so all outside traffic has to pass through Caddy.
module.exports = {
  apps: [
    {
      cwd: resolve(root, "apps/server"),
      env: {
        HOST: "127.0.0.1",
        NODE_ENV: "production",
        PORT: "4000",
        TRUST_PROXY: "1",
      },
      max_memory_restart: "500M",
      name: "fynlo-api",
      script: "dist/main.js",
    },
    {
      args: "start -H 127.0.0.1 -p 3000",
      cwd: resolve(root, "apps/web"),
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
      name: "fynlo-web",
      script: "node_modules/next/dist/bin/next",
    },
  ],
};
