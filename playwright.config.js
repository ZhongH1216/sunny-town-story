const { defineConfig } = require("@playwright/test");
const { appUrl } = require("./tools/env");

const { url } = appUrl();

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: url,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
});
