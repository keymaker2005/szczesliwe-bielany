[out:json][timeout:180];
(
  way["natural"="water"](52.262,20.900,52.311,20.995);
  relation["natural"="water"](52.262,20.900,52.311,20.995);
  way["waterway"="riverbank"](52.262,20.900,52.311,20.995);
  way["natural"~"^(beach|sand)$"](52.262,20.900,52.311,20.995);
  relation["natural"~"^(beach|sand)$"](52.262,20.900,52.311,20.995);
);
out geom;
