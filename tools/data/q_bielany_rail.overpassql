[out:json][timeout:180];
(
  way["railway"~"^(tram|subway|light_rail|rail)$"](52.262,20.900,52.300,20.980);
  node["railway"~"^(station|tram_stop|subway_entrance)$"](52.262,20.900,52.300,20.980);
  node["public_transport"="station"](52.262,20.900,52.300,20.980);
);
out geom tags;
