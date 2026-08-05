# Chronicle Map

A first-class chronicle system inside Wiki.js for pinning historical (or fictional) events onto era-specific maps, with page embeds and a master overview.

## Language

**Chronicle**:
A first-class aggregate that owns era maps, events, and its own tags. Wiki pages embed or link to it; they do not own its data.
_Avoid_: Map collection, project, atlas (as the top-level container)
