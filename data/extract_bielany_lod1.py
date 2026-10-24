"""Wycina budynki LoD1 (GUGiK, EPSG:2180) z paczki zip dla bboxa Bielan i zapisuje GeoJSON w WGS84.
usage: python3 extract_bielany_lod1.py <zip> <out.geojson>
"""
import sys, zipfile, json, re
import xml.etree.ElementTree as ET
from pyproj import Transformer

ZIP, OUT = sys.argv[1], sys.argv[2]
E0, N0, E1, N1 = 630616, 491502, 633607, 494475  # bbox 52.274,20.915 - 52.300,20.960
G = '{http://www.opengis.net/gml}'
B = '{http://www.opengis.net/citygml/building/2.0}'
GEN = '{http://www.opengis.net/citygml/generics/2.0}'
tr = Transformer.from_crs(2180, 4326, always_xy=True)

feats, heights = [], []
with zipfile.ZipFile(ZIP) as z:
    for name in z.namelist():
        with z.open(name) as f:
            head = f.read(6000).decode('utf-8', 'ignore')
        lo = re.search(r'lowerCorner>([\d.]+) ([\d.]+)', head)
        hi = re.search(r'upperCorner>([\d.]+) ([\d.]+)', head)
        if not lo or not hi:
            continue
        le, ln, he, hn = map(float, (*lo.groups(), *hi.groups()))
        if he < E0 or le > E1 or hn < N0 or ln > N1:
            continue
        with z.open(name) as f:
            for _, el in ET.iterparse(f):
                if el.tag != B + 'Building':
                    continue
                h = el.find(B + 'measuredHeight')
                attrs = {a.get('name'): a.findtext(GEN + 'value') for a in el.iter(GEN + 'stringAttribute')}
                best = None
                for pl in el.iter(G + 'posList'):
                    v = list(map(float, pl.text.split()))
                    pts = [(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)]
                    zs = {p[2] for p in pts}
                    if len(zs) == 1 and len(pts) >= 4:
                        zz = pts[0][2]
                        if best is None or zz < best[0]:
                            best = (zz, pts)
                if best and h is not None:
                    ce = sum(p[0] for p in best[1]) / len(best[1])
                    cn = sum(p[1] for p in best[1]) / len(best[1])
                    if E0 <= ce <= E1 and N0 <= cn <= N1:
                        ring = [list(map(lambda c: round(c, 7), tr.transform(p[0], p[1]))) for p in best[1]]
                        hv = float(h.text)
                        heights.append(hv)
                        feats.append({'type': 'Feature', 'properties': {
                            'id': attrs.get('buildingId'), 'height_m': hv, 'ground_z': round(best[0], 2),
                            'source_year': attrs.get('aktZrodla')},
                            'geometry': {'type': 'Polygon', 'coordinates': [ring]}})
                el.clear()

json.dump({'type': 'FeatureCollection', 'name': 'bielany_lod1_2024',
           'attribution': 'GUGiK, geoportal.gov.pl, Modele 3D budynkow LoD1 2024, CC BY 4.0',
           'features': feats}, open(OUT, 'w'), separators=(',', ':'))
heights.sort()
n = len(heights)
print('budynki:', n)
if n:
    print('wysokosc min/mediana/max [m]:', heights[0], heights[n // 2], heights[-1])
    for lo_, hi_ in [(0, 6), (6, 12), (12, 20), (20, 35), (35, 1000)]:
        print(f'  {lo_}-{hi_} m:', sum(lo_ <= x < hi_ for x in heights))
