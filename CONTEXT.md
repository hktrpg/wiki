# Chronicle Map

A first-class chronicle system inside Wiki.js for pinning historical (or fictional) events onto era-specific maps, with page embeds and a master overview.

## Language

**Chronicle**:
A first-class aggregate that owns era maps, events, and its own tags. Wiki pages embed or link to it; they do not own its data.
_Avoid_: Map collection, project, atlas (as the top-level container)

**Event**:
A pin-able record inside a Chronicle — title, summary, when/where it occurred, and tags. May optionally link to one or more Wiki Pages for long-form detail; the pin itself is not a Page.
_Avoid_: Page (for the pin), marker-only stub with no domain identity
