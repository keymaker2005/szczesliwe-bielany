[out:json][timeout:180];
(
  way["natural"="wood"](52.262,20.900,52.311,20.995);
  way["landuse"="forest"](52.262,20.900,52.311,20.995);
  relation["natural"="wood"](52.262,20.900,52.311,20.995);
  relation["landuse"="forest"](52.262,20.900,52.311,20.995);
  way["highway"~"^(path|track|footway|bridleway|steps)$"](52.262,20.900,52.311,20.995);
);
out geom;
