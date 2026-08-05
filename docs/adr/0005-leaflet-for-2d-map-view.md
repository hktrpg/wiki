# Hybrid 2D Map View uses Leaflet

v1 Map View renders in 2D with Leaflet (OSM/public tiles, image overlays for uploaded/derived basemaps). Map Mode still stores `2d|3d|both`, but 3D presentation is deferred. Leaflet was chosen over MapLibre for a smaller dependency and straightforward image-overlay georeferencing; revisit if vector-tile era borders become primary.
