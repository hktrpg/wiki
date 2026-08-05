# Hybrid event placement across Era Maps

Each Event stores one Canonical Position in the Chronicle’s shared spatial reference. Each Era Map carries an Alignment transform to project that position onto the basemap. When projection fails for a specific pin, an optional Pin Override stores a per–Event-per–Era-Map position. Chosen over per-map-only pins (no cross-era reuse) and pure automatic projection (too brittle for scanned or fantasy maps).
