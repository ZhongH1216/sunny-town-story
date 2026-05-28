# P5 Final Texture Prompt Sheet

Use these prompts when an image generation tool is available. Keep every manifest id and output path unchanged. Final files must be opaque `16x16` PNG images with nearest-neighbor pixel edges and readable facade details.

Shared constraints for every texture:

- Warm pixel art for a cozy low-poly 3D town.
- Orthographic square tile, no perspective.
- No text, logo, watermark, characters, gradients, or photorealism.
- Use the listed palette as the dominant colors, with near-white highlights only when needed.
- Downscale or clean up to exactly `16x16`.
- Preserve the current path.

## Texture Prompts

| ID | Output Path | Palette | Prompt |
| --- | --- | --- | --- |
| `residential` | `assets/textures/buildings/residential-v1.png` | `#ffb8c9`, `#ffe3ec`, `#f68eaa`, `#fff5d6` | Small cozy residential house facade, pink roof, two bright windows, tiny cream doorway, warm sunny Japanese-inspired town style. |
| `commercial` | `assets/textures/buildings/commercial-v1.png` | `#ffd36f`, `#fff1a6`, `#ffb85f`, `#ffffff` | Cheerful tiny shop facade, golden awning, simple display windows, bright welcoming storefront, readable at 16x16. |
| `industrial` | `assets/textures/buildings/industrial-v1.png` | `#9fc0cf`, `#d4e5ec`, `#7899a7`, `#f2f6f7` | Clean light industrial workshop facade, cool blue-gray panels, small vents, simple roofline, friendly non-gritty style. |
| `park` | `assets/textures/buildings/park-v1.png` | `#8ddf91`, `#bff0a9`, `#62b96c`, `#ffd0dd` | Tiny park service tile, leafy green canopy hints, small path or flower patch, soft pink blossom detail, cozy and simple. |
| `school` | `assets/textures/buildings/school-v1.png` | `#ffc36e`, `#ffe0a6`, `#f09b50`, `#ffffff` | Small school facade, warm orange roof, bright windows, simple entrance, friendly civic building style. |
| `fire` | `assets/textures/buildings/fire-v1.png` | `#ff8b7f`, `#ffd0ca`, `#e65f5d`, `#ffffff` | Tiny fire station facade, soft red doors, light trim, clear civic service silhouette, no lettering. |
| `power` | `assets/textures/buildings/power-v1.png` | `#ffe47a`, `#fff3b8`, `#f1b84b`, `#ffffff` | Small power utility facade, warm yellow panels, simple bolt-like shape without text, clean and cheerful. |
| `water` | `assets/textures/buildings/water-v1.png` | `#84c9ff`, `#d5f2ff`, `#5aaee7`, `#ffffff` | Small water tower or water utility facade, blue tank hint, bright highlights, simple clean infrastructure. |
| `plaza` | `assets/textures/landmarks/plaza-v1.png` | `#f6d58b`, `#fff0bf`, `#8bcf9a`, `#ffffff` | Tiny community plaza tile, pale stone square, small greenery corners, festive civic landmark feeling. |
| `station` | `assets/textures/landmarks/station-v1.png` | `#b9d8f2`, `#fff4c0`, `#5d8ca8`, `#ffffff` | Small local transit station facade, blue roof, platform-like horizontal band, warm light window, no signs or letters. |
| `lantern` | `assets/textures/landmarks/lantern-v1.png` | `#ffb1a6`, `#ffe0ba`, `#e95f64`, `#ffffff` | Festive lantern landmark tile, soft red lantern shape, warm glow blocks, simple celebration detail, no text. |

## Validation

After replacing textures:

```powershell
npm.cmd test -- --grep "asset|texture|visual"
npm.cmd run test:visual
npm.cmd run verify:package
```

Do not run `npm.cmd run assets:textures` after final replacement unless intentionally regenerating deterministic placeholder art.
