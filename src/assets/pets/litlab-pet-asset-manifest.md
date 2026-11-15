# LitLab Pet Collection — Generation Manifest

**Status:** generation-ready; no raster assets are included in this repository yet.

Use this manifest with a transparent-background image model. Generate **each named file separately** as a 1024 × 1024 PNG with alpha; use a 16 px safe margin and center the character or item. Do not add text, a frame, logos, watermarks, or a background.

## Shared visual anchor

Friendly illustrated storybook game art for a children’s reading adventure: clean rounded shapes, warm coral, plum, amber, and twilight-blue accents, soft paper-like shading, expressive eyes, a three-quarter front-facing view, and a consistent gentle key light from upper left. Characters are original, compact, and readable at 96 px. Accessories are detached, centered objects at the same visual scale. Avoid real-person likenesses, movie/TV designs, logos, distinctive costumes, copied silhouettes, and text.

## Pet assets

Every pet gets these files: `neutral`, `happy`, `thoughtful`, `celebration`, and `icon`. The full poses use the shared visual anchor plus the listed pose direction. The icon is a head-and-shoulders portrait with the same expression as neutral.

| ID and asset prefix | Original design anchor | Public-domain inspiration metadata | Files |
| --- | --- | --- | --- |
| Bramble — `pet-bramble` | Brave small cinnamon-and-cream terrier, one floppy ear, round brass compass tag, upright determined stance. | *The Wonderful Wizard of Oz* (1900): small canine-companion archetype only; no named or screen adaptation design. | `pet-bramble-neutral.png`, `pet-bramble-happy.png`, `pet-bramble-thoughtful.png`, `pet-bramble-celebration.png`, `pet-bramble-icon.png` |
| Curio — `pet-curio` | Curious little russet winged monkey with leaf-shaped wing membranes, large amber eyes, and a tiny cloud-map pouch. | Early fantasy winged-simian archetypes, including *The Wonderful Wizard of Oz* (1900), transformed into an original character; no uniform, cap, or adaptation styling. | `pet-curio-neutral.png`, `pet-curio-happy.png`, `pet-curio-thoughtful.png`, `pet-curio-celebration.png`, `pet-curio-icon.png` |
| Fable — `pet-fable` | Clever copper fox with a cream muzzle, navy story-thread tail tip, alert ears, and a small folded clue card. | *The Adventures of Pinocchio* (1883): trickster-fox archetype only; no copied character markings or companion. | `pet-fable-neutral.png`, `pet-fable-happy.png`, `pet-fable-thoughtful.png`, `pet-fable-celebration.png`, `pet-fable-icon.png` |
| Skye — `pet-skye` | Gentle oversized teal-and-gold heron with soft rounded wings, kind eyes, and a book-leaf feather at the crest. | *The Phoenix and the Carpet* (1904): benevolent magical-bird archetype only; not a phoenix or any adaptation design. | `pet-skye-neutral.png`, `pet-skye-happy.png`, `pet-skye-thoughtful.png`, `pet-skye-celebration.png`, `pet-skye-icon.png` |
| Tinker — `pet-tinker` | Determined small tin traveler with rounded riveted body, warm glowing heart-window, patched satchel, and soft mitten hands. | *The Wonderful Wizard of Oz* (1900): self-made metal-traveler archetype only; no axe, funnel, or copied silhouette. | `pet-tinker-neutral.png`, `pet-tinker-happy.png`, `pet-tinker-thoughtful.png`, `pet-tinker-celebration.png`, `pet-tinker-icon.png` |
| Morrow — `pet-morrow` | Mysterious charcoal forest cat with a moon-shaped ear notch, moss-green eyes, soft tail curl, and a tiny glow mote. | *Alice’s Adventures in Wonderland* (1865): enigmatic-cat archetype only; no stripes, floating head, named reference, or recognizable grin. | `pet-morrow-neutral.png`, `pet-morrow-happy.png`, `pet-morrow-thoughtful.png`, `pet-morrow-celebration.png`, `pet-morrow-icon.png` |

### Pose directions

- `neutral`: relaxed ready stance, open attentive eyes, closed gentle smile.
- `happy`: bright open smile, lifted paws/wings or playful tail movement.
- `thoughtful`: one paw/wing near chin, looking toward a floating non-textual sparkle.
- `celebration`: small joyful hop or wing lift, three detached star sparkles, no confetti text.
- `icon`: crop to a simple readable portrait; keep clear edge separation on transparent alpha.

### Accessory attachment slots

All pet bases reserve these blank, unobstructed placement zones: `hat` (top of head), `clothing` (neck-to-torso), `necklace` (center chest), `backpack` (viewer-right shoulder/back), and `handheld` (viewer-left paw, wing, or hand). Accessories must be optional overlays and may never be baked into the base asset.

## Accessory assets

Each item below is one detached, transparent PNG. Prefixes represent rarity and enable deterministic catalog loading.

### Common

`accessory-common-acorn-cap.png` — hat · soft amber cap with acorn button  
`accessory-common-sunhat.png` — hat · coral brimmed explorer hat  
`accessory-common-reading-scarf.png` — clothing · plum knit scarf  
`accessory-common-explorer-vest.png` — clothing · cream pocket vest  
`accessory-common-paperclip-pendant.png` — necklace · rounded silver paperclip pendant  
`accessory-common-compass-necklace.png` — necklace · tiny amber compass  
`accessory-common-canvas-pack.png` — backpack · moss canvas book pack  
`accessory-common-book-satchel.png` — backpack · coral satchel with blank book flap  
`accessory-common-magnifier.png` — handheld · brass magnifying glass  
`accessory-common-storybook.png` — handheld · closed blank-cover storybook  
`accessory-common-leaf-badge.png` — necklace · green enamel leaf badge  
`accessory-common-round-spectacles.png` — hat · rounded amber spectacles

### Rare

`accessory-rare-star-beret.png` — hat · navy beret with one gold star  
`accessory-rare-moon-cape.png` — clothing · short twilight-blue cape  
`accessory-rare-crystal-pendant.png` — necklace · violet reading crystal  
`accessory-rare-messenger-pack.png` — backpack · plum messenger pack  
`accessory-rare-lantern.png` — handheld · softly glowing amber lantern  
`accessory-rare-quill.png` — handheld · teal feather quill  
`accessory-rare-cloud-pin.png` — necklace · pearl cloud pin  
`accessory-rare-trail-hood.png` — hat · deep coral trail hood

### Epic

`accessory-epic-prism-crown.png` — hat · small iridescent prism crown  
`accessory-epic-librarian-coat.png` — clothing · midnight-blue coat with gold trim  
`accessory-epic-moonstone-locket.png` — necklace · moonstone locket  
`accessory-epic-cloud-pack.png` — backpack · lavender cloud-shaped pack  
`accessory-epic-comet-wand.png` — handheld · coral-and-gold comet wand  
`accessory-epic-map-scroll.png` — handheld · rolled star-map scroll

### Legendary

`accessory-legendary-sunbeam-crown.png` — hat · radiant amber sunbeam crown  
`accessory-legendary-aurora-cape.png` — clothing · flowing teal-to-plum aurora cape  
`accessory-legendary-story-key.png` — necklace · ornate golden story key  
`accessory-legendary-radiant-book.png` — handheld · glowing closed book, no text

### Mythical event only

`accessory-mythical-meteor-hat.png` — hat · small comet-loop hat  
`accessory-mythical-twilight-cloak.png` — clothing · indigo cloak with subtle constellations, no symbols or text  
`accessory-mythical-starlight-staff.png` — handheld · delicate starlight staff

## Rights and delivery checks

- Label every catalog item `original-art`, `public-domain-archetype-inspired`, and `not-a-character-reproduction`.
- Store the literature title, author, publication year, source link, territory review, and reviewer in a rights record before release.
- Verify public-domain status for each launch territory; a public-domain source does not authorize a modern adaptation’s visual design.
- Check alpha transparency against both light and dark UI, remove edge halos, and confirm the full character remains visible at 96 px.
- Keep an approval image for each pet as the identity anchor before generating the four expression variants.
