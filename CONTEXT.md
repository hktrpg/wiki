# Chronicle Map

A first-class chronicle system inside Wiki.js for pinning historical (or fictional) events onto era-specific maps, with page embeds and a master overview.

## Language

**Chronicle**:
A first-class aggregate that owns era maps, events, and its own tags. Wiki pages embed or link to it; they do not own its data.
_Avoid_: Map collection, project, atlas (as the top-level container)

**Event**:
A pin-able record inside a Chronicle — title, summary, when/where it occurred, and tags. May optionally link to one or more Wiki Pages for long-form detail; the pin itself is not a Page.
_Avoid_: Page (for the pin), marker-only stub with no domain identity

**Era Map**:
A dated basemap (2D imagery or 3D scene) owned by a Chronicle, covering a time range. Multiple Era Maps coexist; each can be aligned to a shared spatial reference so the same Event can appear across eras despite scale and position drift.
_Avoid_: Layer (as the map entity), basemap-only asset with no era identity

**Canonical Position**:
The Event's single authoritative location in the Chronicle's shared spatial reference (typically modern lat/lng, or a custom CRS for fictional worlds). Default source for projecting pins onto every Era Map.
_Avoid_: Per-map coordinates (as the primary store), "roughly around here" without a stored point

**Alignment**:
A transform on an Era Map (control points / warp) that maps Canonical Positions onto that basemap's pixel or local space, correcting scale and position drift between eras.
_Avoid_: Manual re-pinning every Event per map, ad-hoc UI pan/zoom offsets

**Pin Override**:
An optional per–Event-per–Era-Map position that replaces the Alignment projection when the default transform is wrong for that pin. Escape hatch only — Canonical Position remains the default.
_Avoid_: Making per-map pins the normal path for every Event

**Occurrence**:
When an Event happened — a point or interval on the Chronicle timeline (may be approximate). Used to decide default Era Map visibility by intersection with each Era Map's time range.
_Avoid_: "Date" alone when an interval or fuzzy span is meant; publication date of the wiki page

**Visibility Override**:
An optional per–Event-per–Era-Map force include or force exclude that replaces the default Occurrence∩Era-Map time-range rule.
_Avoid_: Manually listing every Era Map for every Event as the normal path

**Chronicle Tag**:
A Chronicle-scoped label for filtering and grouping Events on maps (e.g. haunt, traffic death, urban, outlying islands). Independent of Wiki.js Page Tags.
_Avoid_: Page Tag (for map filters), global taxonomy shared across unrelated Chronicles

**Page Tag**:
The existing Wiki.js flat tag on a Wiki Page. Used only for wiki content; not the primary map filter. An Event's linked Pages keep their own Page Tags.
_Avoid_: Reusing Page Tags as the Chronicle's event taxonomy

**Chronicle Overlay**:
An optional map view mode that shows Events (and optionally Era Maps) from more than one Chronicle on the same canvas, with each Chronicle toggleable. Chronicles remain separate aggregates; overlay is a view concern, not a merge of data.
_Avoid_: World Layer inside a single Chronicle; permanently merging taxonomies or alignments across Chronicles

**Map View**:
The single interactive map experience for exploring Chronicles — Era Maps, Event pins, filters, overlays, and (for editors) alignment tools. Reused everywhere; not duplicated per surface.
_Avoid_: Separate “simple embed map” and “full map” products with different data rules

**Chronicle Embed**:
A Map View instance placed inside a Wiki Page, usually with a locked or narrowed scope (one Chronicle, Era Map, Tag set, or Event focus). Same underlying Map View as the master route.
_Avoid_: Static thumbnail that is not a Map View; treating the embed as a second data store

**Event Draft**:
A proposed Event (from Ingest API or AI Analysis) that is not yet a live pin. Becomes an Event only after human confirmation. Same fields as Event, different lifecycle.
_Avoid_: Writing AI/API output straight to live Events; a separate parallel data model unrelated to Event

**Ingest API**:
An HTTP/GraphQL API for submitting structured Event or Event Draft payloads from external systems. Does not bypass confirmation when the payload is marked as draft/AI-sourced.
_Avoid_: Ad-hoc DB inserts; scraping hooks that publish live pins with no review path

**AI Analysis**:
A process that turns unstructured input (text, URL, bulk notes) into one or more Event Drafts — suggested title, Occurrence, Canonical Position, Chronicle Tags — for human review.
_Avoid_: AI as the source of truth; AI that only fills a form with no draft record

**Map Mode**:
How an Era Map is presented in Map View: `2d`, `3d`, or `both` (user-switchable). Events still use a 2D Canonical Position by default; 3D is primarily a presentation concern, with optional elevation later.
_Avoid_: Separate 2D-only and 3D-only Era Map entity types; treating 3D as a different aggregate

**Basemap Source**:
Where an Era Map's imagery or tiles come from. One of: Public Basemap, Uploaded Basemap, or Derived Basemap. Source type lives on the Era Map; it is not a separate aggregate.
_Avoid_: Iframe-only external maps outside the Chronicle model; one-off assets with no source metadata

**Public Basemap**:
A Basemap Source that connects to an open or configured tile/map provider (e.g. OSM, satellite, government open layers) by provider id or URL. Preferred for real-world geographies already in a known CRS.
_Avoid_: Re-uploading public tiles as static images when a provider works

**Uploaded Basemap**:
A Basemap Source from manually uploaded imagery or tile packs — fantasy maps, scanned historical maps, custom art. Usually requires Alignment.
_Avoid_: Treating uploads as already georeferenced without Alignment

**Derived Basemap**:
A Basemap Source produced by AI/API conversion from an image or other map (e.g. suggested Alignment control points, cleaned tile asset). Stored as a draft asset until a human confirms and attaches it to an Era Map.
_Avoid_: AI silently publishing live basemaps; calling this a third aggregate beside Era Map

**Footprint**:
Optional line or polygon geometry on an Event that shows extent (building, road stretch, district). Canonical Position remains required; Footprint does not replace it for alignment, overrides, or default AI geocoding.
_Avoid_: Polygon-only Events with no point; treating Footprint as the primary pin
