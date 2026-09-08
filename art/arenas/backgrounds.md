# Background artwork

Generated with the built-in image-generation tool, then copied into the project. No external image API, image-editing script, or photographic source was used. Both images are 1774 × 887 pixels and are mapped as distant equirectangular backgrounds.

## September 8 painted revisions

The runtime now uses `tropical-panorama-painted.png` and `city-panorama-painted.png`. The un-suffixed copies are retained for Blender composition previews. Both revisions were generated as edits of the earlier panorama, requesting clearer cloud edges, readable ridge/window groups and richer painted detail while retaining the soft stylized palette. The requested4096×2048 size was not produced: the returned files remain1774×887. The improvement is in depicted detail, not pixel resolution.

- Tropical original output: `/Users/edwin/.codex/generated_images/01a07a48-38bd-76a1-8fad-4b06d456695e/exec-c9176261-86bf-4fc4-8350-ef38db412b1c.png`. Edit direction: distinct sculptural cloud lobes, clearer island ridges and calm ocean ripples, soft painted daylight, no nearby props or branding.
- City original output: `/Users/edwin/.codex/generated_images/01a07a48-38bd-76a1-8fad-4b06d456695e/exec-0456cfe9-d2a6-425c-97e6-9e3e32fc6c19.png`. Edit direction: clearer stepped towers, grouped illuminated windows, rim-lit clouds and layered neighborhoods, cyan/blue with rose dusk accents, no billboards or text.

The city background sphere repeats the horizontal panorama twice and reframes its vertical range so the detailed skyline is visible above the modeled rooftop. Actual buildings, deck, foliage, pools and troughs remain3D authored assets. Generated originals remain untouched.

The original generation briefs below describe the earlier base images used as edit targets.

## Tropical Cove

Saved runtime asset: `public/art/arenas/tropical-panorama.png`

Prompt set: stylized-concept; game environment background texture; equirectangular 360-degree panorama; 2:1 aspect ratio, ideally 2048 by 1024. A beautiful clean soft-toon tropical island sky for a playful underwater-hockey game starring tiny cartoon otters. Broad painterly color blocks, soft sculptural cumulus clouds, sunny cyan/azure sky, warm pale sunlight. Calm turquoise ocean horizon at the image vertical midpoint, very distant green rocky island silhouettes concentrated modestly along the horizon. Upper half mostly blue sky and a few large soft clouds; lower half calm blue-turquoise ocean with extremely restrained texture. Distant background only: no swimming pool, buildings, trees near camera, people, characters, signs or lettering. First and last horizontal edges should tile for a 360 panorama. Straight level horizon, no lens distortion, borders, UI, photorealistic detail or noisy textures. Soft colorful stylized 3D adventure-game art direction, behind modeled tropical palms, a cream limestone pool deck and turquoise water.

## Neon Rooftop

Saved runtime asset: `public/art/arenas/city-panorama.png`

Prompt set: stylized-concept; equirectangular 360-degree panorama game background; 2:1 aspect ratio, ideally 2048 by 1024. A beautiful soft-toon futuristic coastal city at blue hour, viewed from the height of a rooftop swimming pool. Distant skyline only; no nearby buildings, railings or pool, which are modeled separately. Clean blue/navy tower silhouettes with varied stepped crowns, restrained cyan and magenta window ribbons, occasional warm peach windows. Atmospheric layers and blue haze, lavender-pink dusk glow along a level horizon at the vertical midpoint, rich indigo sky and soft clouds. Lower half distant blue city haze and small far buildings fading into navy. Broad painterly color blocks, soft highlights, slightly toy-like shapes for a playful stylized 3D sports game. First and last horizontal edges should tile for a 360 panorama. No text, logos, advertising, billboards, people, otters, swimming pool, UI, border, fisheye distortion, photorealistic textures or tiny noisy detail. Cyan/blue dominant with restrained rose-purple accents, behind the modeled rooftop terrace, planters, palms and guards.
