[out:json][timeout:180];
(
  way["railway"~"^(tram|subway|light_rail|rail)$"](52.274,20.915,52.300,20.960);
  node["railway"~"^(station|tram_stop|subway_entrance)$"](52.274,20.915,52.300,20.960);
  node["public_transport"="station"](52.274,20.915,52.300,20.960);
);
out geom tags;
