[out:json][timeout:180];
(
  node["place"](52.262,20.900,52.311,20.995);
  way["place"](52.262,20.900,52.311,20.995);
  relation["boundary"="administrative"]["admin_level"~"^(9|10|11)$"](52.262,20.900,52.311,20.995);
  nwr["landuse"]["name"](52.262,20.900,52.311,20.995);
  nwr["leisure"~"^(park|garden)$"]["name"](52.262,20.900,52.311,20.995);
  nwr["amenity"~"^(school|university|college|hospital|place_of_worship)$"]["name"](52.262,20.900,52.311,20.995);
);
out geom tags;
