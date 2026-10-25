[out:json][timeout:60];
(
  way["leisure"~"^(stadium|pitch|track|sports_centre)$"](52.2965,20.9380,52.3040,20.9520);
  way["building"](52.2965,20.9380,52.3040,20.9520);
  way["barrier"="fence"]["leisure"](52.2965,20.9380,52.3040,20.9520);
  node["man_made"~"mast|floodlight"](52.2965,20.9380,52.3040,20.9520);
  way["highway"]["name"](52.2965,20.9380,52.3040,20.9520);
);
out geom tags;
