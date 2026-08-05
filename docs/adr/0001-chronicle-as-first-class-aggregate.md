# Chronicle as a first-class aggregate

Wiki pages must not own chronicle map data. A Chronicle is its own aggregate (Era Maps, Events, Chronicle Tags, drafts). Pages only embed or link via Map View / Chronicle Embed. This keeps master-map, overlays, and cross-page reuse from being trapped in `page.render`, at the cost of a new module surface beside pages.
