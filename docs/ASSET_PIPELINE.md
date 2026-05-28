# P4 Asset Pipeline

This project uses a warm pixel-texture plus low-poly 3D town style. Runtime code reads `src/asset-manifest.js`; each texture entry has a stable id, output path, palette, and tags.

## Current Pipeline

1. Edit `src/asset-manifest.js`.
2. Run:

```powershell
npm run assets:textures
```

3. Verify:

```powershell
npm test -- --grep "P4 asset"
npm run test:visual
```

The generated PNGs live under `assets/textures/`. The game loads PNG files first and falls back to runtime canvas textures if a file fails.

## Naming

- Building textures: `assets/textures/buildings/<type>-v1.png`
- Landmark textures: `assets/textures/landmarks/<type>-v1.png`
- Future source prompts: `assets/source/<type>.md`
- Keep texture ids equal to `BUILDINGS` keys in `src/app.js`.

## AI Texture Prompt Template

Use this template when replacing placeholder PNGs with AI-assisted art:

```text
Use case: stylized-concept
Asset type: 16x16 pixel texture tile for a low-poly 3D town building
Primary request: <building type> facade texture for Sunny Town Story
Style/medium: warm pixel art, low saturation, cozy Japanese-inspired town, readable at tiny size
Composition/framing: flat orthographic texture, no perspective, square tile, centered facade details
Color palette: use only the palette from src/asset-manifest.js for this asset, plus near-white highlights
Materials/textures: simple blocks, windows, roof or sign hints, no tiny unreadable noise
Constraints: seamless enough for a small box mesh, no text, no logo, no watermark, no characters
Avoid: photorealism, gradients, heavy outlines, dark palettes, excessive purple, beige-only palette
```

## Post-Processing Rules

- Downscale or redraw to `16x16`.
- Use nearest-neighbor scaling only.
- Keep alpha fully opaque unless a future mesh explicitly needs transparency.
- Keep file paths unchanged so saves/tests remain stable.
- Run `npm run test:visual` before committing art changes.

## P4 Acceptance Notes

The current checked-in PNGs are deterministic placeholders generated from the manifest palettes. They are production-path assets, not final art. Replacing them with AI-assisted or hand-polished textures is now a data-only operation as long as ids and paths stay stable.

## P5 RC Note

P5 targets replacing all 11 manifest textures with final AI-assisted pixel art. If the current execution environment does not expose an image generation tool, do not fake the replacement: keep the existing deterministic PNGs, keep every manifest id/path unchanged, and treat final art as the remaining asset-production blocker.

The final texture prompt sheet for P5 lives in `docs/P5_TEXTURE_PROMPTS.md`.
