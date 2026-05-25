const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:8765",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
});
