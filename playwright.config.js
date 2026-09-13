const { defineConfig } = require("@playwright/test");
const { appUrl } = require("./tools/env");

const { url } = appUrl();

module.exports = defineConfig({
  testDir: "./tests",
  // Keep local QA from saturating the player's CPU with several 3D browsers.
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: {
    launchOptions: process.env.SUNNY_TOWN_SOFTWARE_WEBGL === '1' ? { args: ['--use-angle=swiftshader'] } : {},
    baseURL: url,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
});
