# P5 Release Candidate Notes

## Version

`1.0.0-rc.1`

Sunny Town Story is now a local-browser release candidate. The intended release shape is still the existing Python static server plus Windows launch scripts, not an Electron or Tauri desktop package.

## Player-Facing Changes

- Added an in-game help panel with build order, roads and commuting, utilities, upgrades, saves, shortcuts, and main-story goals.
- Added visible version text in the top HUD and help panel.
- Improved corrupt local-save recovery: invalid save data is removed, a new town starts, and the player sees a clear recovery message.
- Expanded automated QA for save lifecycle, bad saves, version/help UI, all buildable tools, upgrades, demolition, long-run simulations, and desktop visual frames.
- Added a local browser package command that outputs a runnable folder and zip while keeping the Python static server and Windows launch scripts.
- Added package and clean-source verification commands for RC acceptance.

## Known Issues

- Final AI-assisted pixel textures are still pending because this execution environment does not expose an image generation tool. The current PNG files are deterministic placeholder assets generated from `src/asset-manifest.js`; prompts and paths are prepared in `docs/P5_TEXTURE_PROMPTS.md`.
- The game targets desktop 16:9 layouts only. Mobile and narrow-screen support are not part of the 1.0 RC scope.
- The map is fixed at 18 x 18. Random maps, larger maps, and terrain editing remain future work.
- Buildings, roads, residents, vehicles, and effects are still built from Three.js primitives with PNG facade textures; there are no GLTF models.
- Long manual play sessions and low-end hardware checks still require human QA beyond the automated test suite.
- Local packages still require Python 3 on the player machine. They include the Three.js browser module, so npm is not required for normal play.

## Manual QA Checklist

- Launch with `start-sunny-town.bat`, verify the browser opens `http://127.0.0.1:8765`.
- Run `npm.cmd run package:local`, then launch the generated `dist/sunny-town-story-1.0.0-rc.1/start-sunny-town.bat`.
- Run `npm.cmd run verify:package` and `npm.cmd run verify:clean`.
- Confirm version `1.0.0-rc.1` is visible in the HUD and help panel.
- Open and close the help panel with the `i` button and `Escape`.
- Save manually, refresh, and confirm the town can continue from local storage.
- Start a new game and clear local save data.
- Corrupt local storage manually and confirm the recovery message appears.
- Build and demolish every tool type: road, avenue, residential, commercial, industrial, park, school, fire, power, water, plaza, station, and lantern.
- Upgrade at least one eligible building and one lane road to an avenue.
- Complete the five-chapter story flow or run the automated 200-week completion scenario.
- Stress test a dense road grid with many homes and services for smooth camera, UI, and moving-agent behavior.
- Verify audio controls, mute/music toggles, speed, pause, undo, zoom, and center-camera controls.

## Store Page Draft

Build a warm little Japanese-inspired harbor town in a bright 3D tabletop world. Plan roads, place homes and services, guide residents through daily commutes, and grow from a tiny main street into a cheerful, livable city. Sunny Town Story is a cozy city-builder about clear feedback, gentle strategy, and the small satisfaction of making every block work.

### Short Description

A cozy 3D town-building game about roads, residents, services, and sunny little city goals.

### Feature Copy

- Plan roads and upgrade busy streets into sakura avenues.
- Balance homes, jobs, water, power, schools, parks, safety, and culture.
- Watch small cars and walkers follow real resident routes.
- Follow five chapter goals, unlock landmarks, and continue in free build.
- Save locally and play in a desktop browser with no account required.
