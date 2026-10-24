"""Wycina drzewa (GUGiK, modele 3D drzew LoD1 2023, CityGML, EPSG:2180) dla bboxa Bielan i zapisuje JSON w WGS84.

Paczka dla Warszawy ma ok. 8,6 GB, a serwer nie obsługuje pobierania fragmentów, więc skrypt czyta ją strumieniowo
(z pliku albo ze standardowego wejścia) i rozpakowuje tylko arkusze, których zasięg zachodzi na bbox; resztę
przeskakuje bez rozpakowywania.

usage: curl -s https://opendata.geoportal.gov.pl/InneDane/Drzewa3D/LOD1/2023/14/1465.zip | \\
         python3 extract_bielany_trees.py - bielany_trees_2023.json
       python3 extract_bielany_trees.py <zip> bielany_trees_2023.json

Każde drzewo: [lon, lat, wysokość m, wysokość pnia (podstawa korony) m, promień korony m].
"""
import sys, struct, zlib, json, re, math

SRC, OUT = sys.argv[1], sys.argv[2]
E0, N0, E1, N1 = 630616, 491502, 633607, 494475  # bbox 52.274,20.915 - 52.300,20.960 (jak w extract_bielany_lod1.py)

# EPSG:2180 (PUWG 1992): poprzeczny Merkator na GRS80, południk 19°, k0 0.9993, E0 500 km, N0 -5300 km. Odwrotność
# wg Snydera (Map Projections, 1987), dokładność poniżej milimetra na tym obszarze.
A, F = 6378137.0, 1 / 298.257222101
E2 = F * (2 - F)
EP2 = E2 / (1 - E2)
K0, LON0, FE, FN = 0.9993, math.radians(19), 500000.0, -5300000.0
E1C = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))


def to_wgs84(e, n):
    m = (n - FN) / K0
    mu = m / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256))
    p1 = mu + (3 * E1C / 2 - 27 * E1C ** 3 / 32) * math.sin(2 * mu) + (21 * E1C ** 2 / 16 - 55 * E1C ** 4 / 32) * math.sin(4 * mu) \
        + (151 * E1C ** 3 / 96) * math.sin(6 * mu) + (1097 * E1C ** 4 / 512) * math.sin(8 * mu)
    c1 = EP2 * math.cos(p1) ** 2
    t1 = math.tan(p1) ** 2
    n1 = A / math.sqrt(1 - E2 * math.sin(p1) ** 2)
    r1 = A * (1 - E2) / (1 - E2 * math.sin(p1) ** 2) ** 1.5
    d = (e - FE) / (n1 * K0)
    lat = p1 - (n1 * math.tan(p1) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4 / 24
                                           + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = LON0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5 / 120) / math.cos(p1)
    return math.degrees(lon), math.degrees(lat)


class Stream:
    """Sequential reader over a file or stdin, with skip()"""
    def __init__(self, f):
        self.f = f
        self.pos = 0

    def read(self, n):
        out = bytearray()
        while len(out) < n:
            chunk = self.f.read(min(n - len(out), 1 << 20))
            if not chunk:
                break
            out += chunk
        self.pos += len(out)
        return bytes(out)

    def skip(self, n):
        while n > 0:
            got = len(self.read(min(n, 1 << 22)))
            if not got:
                return
            n -= got


TREE = re.compile(r'<veg:SolitaryVegetationObject\b.*?</veg:SolitaryVegetationObject>', re.S)
POS = re.compile(r'<gml:posList>([^<]+)</gml:posList>')
HEIGHT = re.compile(r'<veg:height[^>]*>([\d.]+)<')
GROUND = re.compile(r'name="h_nmt">\s*<gen:value>([\d.]+)<')


def tree_of(xml):
    """A tree from its crown object. GUGiK models every tree as two objects: the trunk (a prism from the ground, two
    z levels) and the crown (a solid from its base up to the tree's height); trunks are skipped, the crown gives the
    tree's place, height, crown base and radius."""
    h = HEIGHT.search(xml)
    g = GROUND.search(xml)
    if not h or not g:
        return None
    pts = []
    for pl in POS.findall(xml):
        v = list(map(float, pl.split()))
        pts += [(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v) - 2, 3)]
    if not pts:
        return None
    ground, height = float(g.group(1)), float(h.group(1))
    zs = sorted({round(p[2], 2) for p in pts})
    if len(zs) <= 2:
        return None  # a trunk
    ce = sum(p[0] for p in pts) / len(pts)
    cn = sum(p[1] for p in pts) / len(pts)
    if not (E0 <= ce <= E1 and N0 <= cn <= N1):
        return None
    crown_base = zs[0] - ground
    radius = max(math.hypot(p[0] - ce, p[1] - cn) for p in pts)
    lon, lat = to_wgs84(ce, cn)
    return [round(lon, 7), round(lat, 7), round(height, 1), round(max(0.5, crown_base), 1), round(radius, 1)]


def main():
    f = sys.stdin.buffer if SRC == '-' else open(SRC, 'rb')
    s = Stream(f)
    trees, sheets, scanned = [], [], 0
    while True:
        head = s.read(30)
        if len(head) < 30 or struct.unpack('<I', head[:4])[0] != 0x04034b50:
            break  # the central directory: no more entries
        _, _, flag, meth, _, _, _, csize, usize, nlen, elen = struct.unpack('<IHHHHHIIIHH', head)
        name = s.read(nlen).decode('utf-8', 'replace')
        extra = s.read(elen)
        if csize == 0xFFFFFFFF:  # zip64 sizes in the extra field
            j = 0
            while j + 4 <= len(extra):
                hid, size = struct.unpack('<HH', extra[j:j + 4])
                if hid == 1:
                    usize, csize = struct.unpack('<QQ', extra[j + 4:j + 20])
                j += 4 + size
        if flag & 8:
            sys.exit('entries with data descriptors are not supported: ' + name)
        scanned += 1
        if meth != 8 or not name.endswith('.gml'):
            s.skip(csize)
            continue
        # the sheet's extent from the start of its XML
        first = s.read(min(csize, 65536))
        dec = zlib.decompressobj(-15)
        text = dec.decompress(first).decode('utf-8', 'ignore')
        lo = re.search(r'lowerCorner>([\d.]+) ([\d.]+)', text)
        hi = re.search(r'upperCorner>([\d.]+) ([\d.]+)', text)
        hit = lo and hi and not (float(hi.group(1)) < E0 or float(lo.group(1)) > E1 or float(hi.group(2)) < N0 or float(lo.group(2)) > N1)
        if not hit:
            s.skip(csize - len(first))
            continue
        sheets.append(name)
        left = csize - len(first)
        buf = text
        while True:
            last = 0
            for m in TREE.finditer(buf):
                t = tree_of(m.group(0))
                if t:
                    trees.append(t)
                last = m.end()
            buf = buf[last:]
            if left <= 0:
                break
            chunk = s.read(min(left, 1 << 22))
            left -= len(chunk)
            buf += dec.decompress(chunk).decode('utf-8', 'ignore')
        print(f'{name}: {len(trees)} drzew razem', file=sys.stderr, flush=True)
    json.dump({'name': 'bielany_trees_2023',
               'attribution': 'GUGiK, geoportal.gov.pl, Modele 3D drzew LoD1 2023, CC BY 4.0',
               'fields': ['lon', 'lat', 'height_m', 'crown_base_m', 'crown_radius_m'],
               'sheets': sheets, 'trees': trees}, open(OUT, 'w'), separators=(',', ':'))
    print(f'arkusze: {scanned}, w bboxie: {len(sheets)}, drzewa: {len(trees)}', file=sys.stderr)


if __name__ == '__main__':
    main()
