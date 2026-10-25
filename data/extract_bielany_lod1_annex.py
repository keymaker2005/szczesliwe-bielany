"""Wycina z paczki LoD1 2024 (GUGiK) budynki landmarków leżących tuż za wschodnią granicą obszaru MVP (lon > 20.960):
wschodnie skrzydła AWF, kampus UKSW przy Dewajtis i zespół Kamedułów. Zapisuje GeoJSON w WGS84 jak
extract_bielany_lod1.py (pola height_m, ground_z), tylko dla budynków, których środek leży w podanych prostokątach.

usage: python3 extract_bielany_lod1_annex.py data/raw/LoD1_2024_Warszawa_1465.zip data/bielany_lod1_annex.geojson
"""
import sys, zipfile, json, re, os
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_bielany_trees import to_wgs84  # noqa: E402  (EPSG:2180 -> WGS84, bez pyproj)

ZIP, OUT = sys.argv[1], sys.argv[2]
# (lat0, lon0, lat1, lon1): AWF (wschodnie skrzydła), UKSW Dewajtis i Kameduły
AREAS = {
    'awf': (52.2825, 20.9600, 52.2875, 20.9640),
    'uksw-kameduly': (52.2935, 20.9600, 52.2980, 20.9640),
}
E_MIN = 633500  # arkusze na wschodnim skraju wycinka MVP i dalej
G = '{http://www.opengis.net/gml}'
B = '{http://www.opengis.net/citygml/building/2.0}'

feats = []
with zipfile.ZipFile(ZIP) as z:
    for name in z.namelist():
        with z.open(name) as f:
            head = f.read(6000).decode('utf-8', 'ignore')
        lo = re.search(r'lowerCorner>([\d.]+) ([\d.]+)', head)
        hi = re.search(r'upperCorner>([\d.]+) ([\d.]+)', head)
        if not lo or not hi or float(hi.group(1)) < E_MIN or float(lo.group(1)) > E_MIN + 1500:
            continue
        if float(hi.group(2)) < 491000 or float(lo.group(2)) > 495500:
            continue
        with z.open(name) as f:
            for _, el in ET.iterparse(f):
                if el.tag != B + 'Building':
                    continue
                h = el.find(B + 'measuredHeight')
                best = None
                for pl in el.iter(G + 'posList'):
                    v = list(map(float, pl.text.split()))
                    pts = [(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v) - 2, 3)]
                    zs = {p[2] for p in pts}
                    if len(zs) == 1 and len(pts) >= 4 and (best is None or pts[0][2] < best[0]):
                        best = (pts[0][2], pts)
                el.clear()
                if best is None or h is None:
                    continue
                ring = [to_wgs84(p[0], p[1]) for p in best[1]]
                lon = sum(p[0] for p in ring) / len(ring)
                lat = sum(p[1] for p in ring) / len(ring)
                area = next((k for k, (a0, o0, a1, o1) in AREAS.items() if a0 <= lat <= a1 and o0 <= lon <= o1), None)
                if not area or lon <= 20.9602:
                    continue
                feats.append({'type': 'Feature', 'properties': {'height_m': round(float(h.text), 2), 'ground_z': round(best[0], 2), 'area': area},
                              'geometry': {'type': 'Polygon', 'coordinates': [[[round(x, 7), round(y, 7)] for x, y in ring]]}})
json.dump({'type': 'FeatureCollection', 'name': 'bielany_lod1_annex',
           'attribution': 'GUGiK, geoportal.gov.pl, Modele 3D budynków LoD1 2024, CC BY 4.0', 'features': feats},
          open(OUT, 'w'), separators=(',', ':'))
print(f'{len(feats)} budynków: ' + ', '.join(f"{k} {sum(1 for f in feats if f['properties']['area'] == k)}" for k in AREAS))
