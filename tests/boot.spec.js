const { test, expect } = require('@playwright/test');

test('the game boots with working WebGL and no missing runtime modules', async ({ page }) => {
  const errors = [];
  const resources = [];
  const consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => resources.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.status() >= 400) resources.push(`${response.url()}: HTTP ${response.status()}`);
  });
  try {
    await page.goto('/?test=1', { timeout: 15000 });
    await page.waitForFunction(() => Boolean(window.sunnyTownTest?.demo), null, { timeout: 10000 });
  } catch (error) {
    let timer;
    const graphics = await Promise.race([
      page.evaluate(() => {
        const canvas = document.querySelector('#scene');
        const gl = canvas?.getContext('webgl2');
        return { canvas: Boolean(canvas), webgl2: Boolean(gl), lost: gl?.isContextLost() };
      }).catch(probeError => ({ probeError: probeError.message })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ probeError: 'Graphics probe timed out' }), 2000); }),
    ]).finally(() => clearTimeout(timer));
    throw new Error(`Game startup failed. ${JSON.stringify({ errors, resources, consoleErrors, graphics })}\n${error.message}`);
  }
  expect(errors, 'Uncaught startup errors').toEqual([]);
  expect(resources, 'Failed runtime requests').toEqual([]);
  const graphics = await page.locator('#scene').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    return { width: canvas.width, height: canvas.height, alive: Boolean(gl && !gl.isContextLost()) };
  });
  expect(graphics.alive).toBe(true);
  expect(graphics.width).toBeGreaterThan(0);
  expect(graphics.height).toBeGreaterThan(0);
});
