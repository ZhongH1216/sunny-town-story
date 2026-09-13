// Bounded serial rendering probe. Never runs alongside the regression browser.
// Default ANGLE is attempted unless --software is explicitly requested.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const software = process.argv.includes('--software');
const label = process.argv.find(arg => arg.startsWith('--label='))?.slice(8) || 'snapshot';
const baseURL = process.env.SUNNY_TOWN_PROFILE_URL || 'http://127.0.0.1:8767';
const python = process.env.SUNNY_TOWN_PYTHON || 'python';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] || 0;
const round = number => Math.round(number * 100) / 100;
const sourceHashes = () => Object.fromEntries(['src/app.js', 'src/world-art.js', 'src/art-batch.js', 'src/neighborhoods.js'].filter(file => fs.existsSync(path.join(root, file))).map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));

async function available() {
  return new Promise(resolve => {
    const req = http.get(baseURL, response => { response.resume(); resolve(response.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  let server, browser;
  const report = { label, sourceHashes: sourceHashes(), backendRequested: software ? 'swiftshader' : 'default-angle', viewport: { width: 1366, height: 768 }, testMode: true, preserveDrawingBuffer: true, metricNotes: 'CDP TaskDuration measures page main-thread time, not total system CPU or the GPU process. Both comparison runs use the test-only preserved drawing buffer. SwiftShader results only compare the same software backend; they do not certify hardware frame rates.', samples: [] };
  const output = path.join(root, 'dist', 'performance');
  fs.mkdirSync(output, { recursive: true });
  try {
    if (!await available()) {
      server = spawn(python, ['app.py', '--port', new URL(baseURL).port], { cwd: root, windowsHide: true, stdio: 'ignore' });
      for (let i = 0; i < 40 && !await available(); i += 1) await delay(100);
      if (!await available()) throw new Error('Probe server did not start');
    }
    browser = await chromium.launch({ headless: true, args: software ? ['--use-angle=swiftshader'] : [] });
    const page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      window.__renderProbe = { frames: [], longTasks: [], recording: false };
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(timestamp => {
        const framesBefore = window.sunnyTownTest?.getRenderStats?.().frames;
        const started = performance.now();
        callback(timestamp);
        const rendered = framesBefore === undefined || window.sunnyTownTest.getRenderStats().frames !== framesBefore;
        if (rendered && window.__renderProbe.recording && window.__renderProbe.frames.length < 1000) window.__renderProbe.frames.push({ at: started, cpu: performance.now() - started });
      });
      new PerformanceObserver(list => {
        if (window.__renderProbe.recording) window.__renderProbe.longTasks.push(...list.getEntries().map(entry => entry.duration));
      }).observe({ entryTypes: ['longtask'] });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + '/?test=1');
    await page.waitForFunction(() => window.sunnyTownTest?.demo, { timeout: 15000 });
    await delay(500);
    report.backend = await page.locator('#scene').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return { lost: !gl || gl.isContextLost(), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) };
    });
    if (report.backend.lost) throw new Error('Default graphics context was lost; no comparable measurements collected');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
    for (const town of ['harbor', 'dense']) {
      const loaded = await page.evaluate(town => {
        const game = window.sunnyTownTest;
        game.demo.startScenario('harbor');
        game.setSettings({ muted: true, music: false });
        if (town === 'harbor') return true;
        const save = game.serializeGame();
        const roads = [], buildings = [];
        const types = ['residential', 'residential', 'commercial', 'park', 'residential', 'industrial', 'power', 'water', 'school', 'fire'];
        for (let z = 1; z <= 16; z += 1) for (let x = 1; x <= 16; x += 1) {
          if (z % 3 === 2 || x === 1) roads.push({ x, z, roadTier: x % 3 === 0 ? 'avenue' : 'lane' });
          else buildings.push({ id: `profile-${x}-${z}`, type: types[(x + z * 3) % types.length], x, z, level: 1 + (x % 3 === 0 ? 1 : 0), age: 10 });
        }
        Object.assign(save.city, { tiles: roads, buildings, week: 51, population: 1200, money: 50000, demo: null, life: null, completed: true, activeEvents: [], history: [] });
        return game.loadSave(save);
      }, town);
      if (!loaded) throw new Error('Density fixture rejected');
      for (const mode of ['eco', 'balanced']) {
        await page.evaluate(mode => {
          window.sunnyTownTest.setSettings({ performance: mode });
          if (window.sunnyTownTest.getState().paused) document.getElementById('pauseButton').click();
        }, mode);
        await delay(1000);
        const initial = await page.evaluate(() => {
          window.__renderProbe.frames = []; window.__renderProbe.longTasks = []; window.__renderProbe.recording = true;
          return { now: performance.now(), state: window.sunnyTownTest.getState() };
        });
        const before = await metrics();
        await delay(3200);
        const after = await metrics();
        const final = await page.evaluate(() => {
          window.__renderProbe.recording = false;
          return { now: performance.now(), state: window.sunnyTownTest.getState(), probe: window.__renderProbe };
        });
        const seconds = (final.now - initial.now) / 1000;
        const intervals = final.probe.frames.slice(1).map((frame, index) => frame.at - final.probe.frames[index].at);
        report.samples.push({ town, mode, buildings: final.state.buildingCount, residents: final.state.stats.population, seconds: round(seconds), fps: round((final.state.rendering.frames - initial.state.rendering.frames) / seconds), frameIntervalP50Ms: round(percentile(intervals, .5)), frameIntervalP95Ms: round(percentile(intervals, .95)), frameCpuP50Ms: round(percentile(final.probe.frames.map(frame => frame.cpu), .5)), frameCpuP95Ms: round(percentile(final.probe.frames.map(frame => frame.cpu), .95)), mainThreadMsPerSecond: round((after.TaskDuration - before.TaskDuration) * 1000 / seconds), scriptMsPerSecond: round((after.ScriptDuration - before.ScriptDuration) * 1000 / seconds), layoutMsPerSecond: round((after.LayoutDuration - before.LayoutDuration) * 1000 / seconds), styleMsPerSecond: round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000 / seconds), heapMB: round(after.JSHeapUsedSize / 1048576), longTasks: final.probe.longTasks.map(round), rendering: final.state.rendering, art: final.state.art });
        console.log(JSON.stringify(report.samples.at(-1)));
      }
      const costs = await page.evaluate(() => {
        const game = window.sunnyTownTest;
        if (!game.getState().paused) document.getElementById('pauseButton').click();
        const durations = [];
        for (let i = 0; i < 5; i += 1) { const start = performance.now(); game.recompute(); durations.push(performance.now() - start); }
        return durations;
      });
      report.samples.at(-1).recomputeMs = costs.map(round);
      await page.screenshot({ path: path.join(output, `${label}-${town}.png`) });
    }
    report.pageErrors = errors;
    report.sourceChangedDuringProbe = Object.entries(sourceHashes()).filter(([file, hash]) => report.sourceHashes[file] !== hash).map(([file]) => file);
    report.ok = errors.length === 0 && report.sourceChangedDuringProbe.length === 0;
  } catch (error) {
    report.ok = false; report.error = error.message; process.exitCode = 1;
  } finally {
    await browser?.close();
    server?.kill();
    fs.writeFileSync(path.join(output, `${label}-${software ? 'software' : 'default'}.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ok: report.ok, backend: report.backend, error: report.error, output }));
  }
}
main();
