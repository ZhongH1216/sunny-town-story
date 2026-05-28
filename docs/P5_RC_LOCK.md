# P5 RC Lock Record

Version: `1.0.0-rc.1`

Date: 2026-05-28

## Release Shape

- Local desktop browser game.
- Python static server via `app.py`.
- Windows launch scripts remain the primary player entry point.
- No Electron or Tauri wrapper for this RC.
- Local package output:
  - `dist/sunny-town-story-1.0.0-rc.1/`
  - `dist/sunny-town-story-1.0.0-rc.1.zip`

## Lock Policy

Allowed after this point:

- Blocker bug fixes.
- QA automation fixes.
- Release documentation corrections.
- Final replacement of the 11 stable-path PNG textures if image generation tooling becomes available.

Avoid after this point:

- New gameplay systems.
- Save schema changes unless required for a blocker.
- New dependencies or packaging frameworks.
- UI layout redesigns beyond targeted bug fixes.

## Required Gates

- `npm.cmd run check`
- `npm.cmd test`
- `npm.cmd run test:visual`
- `npm.cmd run assets:textures`
- `npm.cmd run verify:package`
- `npm.cmd run verify:clean`

## Known RC Blockers / Exceptions

- Final AI-assisted texture replacement is not complete because no `image_gen` tool is exposed in the current session.
- Separate-machine manual verification is still pending.
- Low-end hardware and 60-minute continuous manual play are still pending.

The current RC can be treated as a functional local-browser release candidate once the required gates pass, with the above exceptions carried explicitly.
