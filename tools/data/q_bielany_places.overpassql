[out:json][timeout:180];
(
  node["place"](52.274,20.915,52.300,20.960);
  way["place"](52.274,20.915,52.300,20.960);
  relation["boundary"="administrative"]["admin_level"~"^(9|10|11)$"](52.274,20.915,52.300,20.960);
  nwr["landuse"]["name"](52.274,20.915,52.300,20.960);
  nwr["leisure"~"^(park|garden)$"]["name"](52.274,20.915,52.300,20.960);
  nwr["amenity"~"^(school|university|college|hospital|place_of_worship)$"]["name"](52.274,20.915,52.300,20.960);
);
out geom tags;
