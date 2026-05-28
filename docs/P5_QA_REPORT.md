# P5 QA Report

Version: `1.0.0-rc.1`

Date: 2026-05-28

## Automated Verification

| Area | Command | Status | Notes |
| --- | --- | --- | --- |
| Environment | `npm.cmd run check` | Passed | Confirms Node, npm, Python, lockfile, Three.js module, and URL. |
| Smoke and gameplay | `npm.cmd test` | Passed | Covers 36 Playwright tests after P5 additions. |
| Visual frames | `npm.cmd run test:visual` | Passed | Covers 1440 x 900 and 1366 x 768 desktop frames. |
| Texture generator | `npm.cmd run assets:textures` | Passed | Verifies deterministic placeholder generator still works. |
| Local package | `npm.cmd run verify:package` | Passed | Builds package, checks zip layout/files/textures, serves package, and requests runtime routes. |
| Clean source | `npm.cmd run verify:clean` | Passed | Copies a clean source tree under `dist/`, runs `npm ci`, `check`, and full tests. |

## Manual QA Checklist

| Item | Status | Notes |
| --- | --- | --- |
| Launch game from source with `start-sunny-town.bat` | Ready for manual pass | Browser should open `http://127.0.0.1:8765`. |
| Launch generated package with `dist/sunny-town-story-1.0.0-rc.1/start-sunny-town.bat` | Ready for manual pass | Package includes Three.js browser module; Python 3 is still required. |
| Version visible in HUD and help panel | Automated | Covered by P5 version/help test. |
| Help panel opens from HUD and closes with button/Escape | Automated | Covered by P5 version/help test and visual regression. |
| Manual save and continue after refresh | Automated | Covered by save lifecycle and save restore tests. |
| New game and clear save | Automated | Covered by save lifecycle test. |
| Corrupt save recovery | Automated | Invalid save is removed, new town starts, and UI recovery message appears. |
| All tools build and demolish | Automated | Road, avenue, residential, commercial, industrial, park, school, fire, power, water, plaza, station, lantern. |
| Building and road upgrades | Automated | Covered by P2/P5 upgrade tests. |
| Five chapter completion | Automated | Covered by 200-week long-run completion test. |
| Dense/extreme city stability | Automated | Dense grid, low funds, broken road, long-run metrics, and visual-agent cap. |
| Audio controls | Automated partial | Settings and shortcut flow covered; subjective sound balance needs human pass. |
| Keyboard shortcuts, undo, camera controls | Automated | Covered by P4 controls tests. |
| Low-end hardware feel | Manual required | Needs human pass on target low-spec Windows machine. |
| 60-minute continuous play | Manual required | Automation covers long simulations, not human pacing or fatigue. |

## New Machine / Clean Environment

The reproducible check is now scripted:

```powershell
npm.cmd run verify:clean
```

This copies the repository into `dist/clean-source-check/sunny-town-story`, excluding local generated folders and environment files, then runs:

```powershell
npm ci
npm run check
npm test
```

This satisfies the local clean-source gate. Manual new-machine acceptance remains open until the same flow is repeated on a separate Windows machine or VM.

## Package Verification

The package check is now scripted:

```powershell
npm.cmd run verify:package
```

It verifies:

- `dist/sunny-town-story-1.0.0-rc.1/` exists.
- `dist/sunny-town-story-1.0.0-rc.1.zip` exists.
- The zip extracts under one top-level `sunny-town-story-1.0.0-rc.1/` directory.
- Runtime files, docs, scripts, `three.module.js`, and all 11 PNG textures are present.
- A Python static server started from the package can serve `/`, `index.html`, `src/app.js`, `src/asset-manifest.js`, `three.module.js`, and a texture route.

## Remaining QA Risk

- Final AI-assisted texture replacement is blocked by unavailable image generation tooling in this session.
- Low-end hardware feel and 60-minute manual play remain human QA items.
- True separate-machine verification remains pending until run outside the current workspace.
