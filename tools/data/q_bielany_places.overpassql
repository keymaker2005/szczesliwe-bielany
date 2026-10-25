[out:json][timeout:180];
(
  node["place"](52.262,20.900,52.300,20.980);
  way["place"](52.262,20.900,52.300,20.980);
  relation["boundary"="administrative"]["admin_level"~"^(9|10|11)$"](52.262,20.900,52.300,20.980);
  nwr["landuse"]["name"](52.262,20.900,52.300,20.980);
  nwr["leisure"~"^(park|garden)$"]["name"](52.262,20.900,52.300,20.980);
  nwr["amenity"~"^(school|university|college|hospital|place_of_worship)$"]["name"](52.262,20.900,52.300,20.980);
);
out geom tags;
