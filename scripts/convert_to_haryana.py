"""
Convert WCD dummy data layer from Gujarat to Haryana.
Deliverables:
  1. haryana_region_mapping.json (replacing gujarat_region_mapping.xlsx)
  2. Updated per-sheet JSON data files with Haryana district names, region names,
     and district_codes substituted in — all numeric KPI values preserved as-is.
  3. Updated GeoJSON file wired for the choropleth map.
"""

import json
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"

# ============================================================================
# 1. HARYANA GROUND TRUTH (Step 1)
# ============================================================================
HARYANA_DATA = [
    {"Region": "Ambala", "District": "Ambala", "District_Code": 58},
    {"Region": "Ambala", "District": "Kurukshetra", "District_Code": 68},
    {"Region": "Ambala", "District": "Panchkula", "District_Code": 70},
    {"Region": "Ambala", "District": "Yamunanagar", "District_Code": 76},
    {"Region": "Karnal", "District": "Karnal", "District_Code": 67},
    {"Region": "Karnal", "District": "Panipat", "District_Code": 71},
    {"Region": "Karnal", "District": "Kaithal", "District_Code": 66},
    {"Region": "Rohtak", "District": "Rohtak", "District_Code": 73},
    {"Region": "Rohtak", "District": "Jhajjar", "District_Code": 64},
    {"Region": "Rohtak", "District": "Sonipat", "District_Code": 75},
    {"Region": "Rohtak", "District": "Bhiwani", "District_Code": 59},
    {"Region": "Rohtak", "District": "Charkhi Dadri", "District_Code": 701},
    {"Region": "Hisar", "District": "Hisar", "District_Code": 63},
    {"Region": "Hisar", "District": "Hansi", "District_Code": 396},
    {"Region": "Hisar", "District": "Fatehabad", "District_Code": 61},
    {"Region": "Hisar", "District": "Sirsa", "District_Code": 74},
    {"Region": "Hisar", "District": "Jind", "District_Code": 65},
    {"Region": "Gurugram", "District": "Gurugram", "District_Code": 62},
    {"Region": "Gurugram", "District": "Rewari", "District_Code": 72},
    {"Region": "Gurugram", "District": "Mahendragarh", "District_Code": 69},
    {"Region": "Faridabad", "District": "Faridabad", "District_Code": 60},
    {"Region": "Faridabad", "District": "Palwal", "District_Code": 619},
    {"Region": "Faridabad", "District": "Nuh", "District_Code": 604},
]

# Sort Haryana districts by (Region asc, District asc)
HARYANA_SORTED = sorted(HARYANA_DATA, key=lambda x: (x["Region"].upper(), x["District"].upper()))

# Step 5: Write haryana_region_mapping.json
with open(PROJECT_ROOT / "haryana_region_mapping.json", "w", encoding="utf-8") as f:
    json.dump(HARYANA_DATA, f, indent=2)

with open(DATA_DIR / "haryana_region_mapping.json", "w", encoding="utf-8") as f:
    json.dump(HARYANA_DATA, f, indent=2)

print("Step 5 complete: Created haryana_region_mapping.json")

# ============================================================================
# 2. GUJARAT 33 DISTRICTS & STEP 2 REDUCTION LOGIC
# ============================================================================
GUJARAT_REGIONS = {
    "Central Gujarat": [
        ("ANAND", "440"), ("CHHOTA UDAIPUR", "668"), ("DAHOD", "445"),
        ("KHEDA", "450"), ("MAHISAGAR", "669"), ("NARMADA", "452"),
        ("PANCHMAHAL", "454"), ("VADODARA", "461")
    ],
    "Coastal Saurashtra": [
        ("AMRELI", "439"), ("BHAVNAGAR", "443"), ("DEVBHUMI DWARKA", "674"),
        ("GIR SOMNATH", "675"), ("JUNAGADH", "448"), ("PORBANDAR", "456")
    ],
    "Kutch": [
        ("Kutch", "449")
    ],
    "North Gujarat": [
        ("AHMEDABAD", "438"), ("ARAVALLI", "672"), ("BANASKANTHA", "441"),
        ("GANDHINAGAR", "446"), ("Mehsana", "451"), ("PATAN", "455"),
        ("SABARKANTHA", "458")
    ],
    "Saurashtra": [
        ("BOTAD", "676"), ("JAMNAGAR", "447"), ("MORBI", "673"),
        ("RAJKOT", "457"), ("SURENDRANAGAR", "460")
    ],
    "South Gujarat": [
        ("BHARUCH", "442"), ("DANG", "444"), ("NAVSARI", "453"),
        ("SURAT", "459"), ("TAPI", "641"), ("VALSAD", "462")
    ]
}

PILOT_DISTRICTS = {"DAHOD", "BHAVNAGAR", "NARMADA", "JAMNAGAR", "DEVBHUMI DWARKA", "DANG"}

DROPPED_GUJARAT = {}
SURVIVING_GUJARAT = []

for reg, dists in sorted(GUJARAT_REGIONS.items()):
    sorted_d = sorted(dists, key=lambda x: x[0].upper())
    if reg == "Kutch":
        DROPPED_GUJARAT[reg] = []
        SURVIVING_GUJARAT.extend([(reg, d[0], d[1]) for d in sorted_d])
        continue
    to_drop = []
    for d in reversed(sorted_d):
        if len(to_drop) == 2:
            break
        if d[0].upper() not in PILOT_DISTRICTS:
            to_drop.append(d)
    DROPPED_GUJARAT[reg] = to_drop
    kept = [d for d in sorted_d if d not in to_drop]
    SURVIVING_GUJARAT.extend([(reg, d[0], d[1]) for d in kept])

# Sort surviving Gujarat by (Region asc, District asc)
GUJARAT_SORTED = sorted(SURVIVING_GUJARAT, key=lambda x: (x[0].upper(), x[1].upper()))

print("Step 2 complete: Dropped 10 Gujarat districts:")
for reg, dlist in DROPPED_GUJARAT.items():
    print(f"  {reg}: {[d[0] for d in dlist]}")

# ============================================================================
# 3. STEP 3: 1:1 POSITIONAL NAME SUBSTITUTION
# ============================================================================
GJ_TO_HR = {}
DROPPED_GJ_CODES = set()
for dlist in DROPPED_GUJARAT.values():
    for d in dlist:
        DROPPED_GJ_CODES.add(str(d[1]))

for g, h in zip(GUJARAT_SORTED, HARYANA_SORTED):
    mapping_entry = {
        "gujarat_region": g[0],
        "gujarat_district": g[1],
        "gujarat_code": g[2],
        "haryana_region": h["Region"],
        "haryana_district": h["District"],
        "haryana_code": h["District_Code"],
    }
    GJ_TO_HR[str(g[2])] = mapping_entry

print("\nStep 3 complete: 1:1 Positional Mapping Table (23 rows):")
for k, v in GJ_TO_HR.items():
    print(f"  {v['gujarat_district']:16} ({v['gujarat_code']:>3}) -> {v['haryana_district']:15} ({v['haryana_code']:>3}) [{v['haryana_region']}]")

# ============================================================================
# 4. STEP 6: NSWLD-01 SPECIAL CASE (AYUSH THR - 6 pilot districts)
# ============================================================================
NSWLD_01_MAPPING = {
    # BHAVNAGAR (443) -> Ambala (58)
    "443": {"haryana_district": "Ambala", "haryana_code": 58, "haryana_region": "Ambala"},
    # DAHOD (445) -> Bhiwani (59)
    "445": {"haryana_district": "Bhiwani", "haryana_code": 59, "haryana_region": "Rohtak"},
    # DANG (444) -> Faridabad (60)
    "444": {"haryana_district": "Faridabad", "haryana_code": 60, "haryana_region": "Faridabad"},
    # DEVBHUMI DWARKA (674) -> Fatehabad (61)
    "674": {"haryana_district": "Fatehabad", "haryana_code": 61, "haryana_region": "Hisar"},
    # JAMNAGAR (447) -> Gurugram (62)
    "447": {"haryana_district": "Gurugram", "haryana_code": 62, "haryana_region": "Gurugram"},
    # NARMADA (452) -> Kaithal (66)
    "452": {"haryana_district": "Kaithal", "haryana_code": 66, "haryana_region": "Karnal"},
}

# ============================================================================
# 5. STEP 4: GEOJSON CHOROPLETH PROCESSING
# ============================================================================
print("\n--- Step 4: Processing GeoJSON ---")
with open(PROJECT_ROOT / "Haryana.geojson", "r", encoding="utf-8") as f:
    geojson_data = json.load(f)

# Split Hisar at longitude 75.85 to create Hansi polygon if not present
has_hansi = any(f["properties"].get("district") == "Hansi" for f in geojson_data["features"])
if not has_hansi:
    hisar_idx = next(i for i, f in enumerate(geojson_data["features"]) if f["properties"].get("district") == "Hisar")
    hisar_feature = geojson_data["features"][hisar_idx]
    coords = hisar_feature["geometry"]["coordinates"][0]

    split_x = 75.85
    crossings = []
    for i in range(len(coords) - 1):
        p1 = coords[i]
        p2 = coords[i+1]
        if (p1[0] - split_x) * (p2[0] - split_x) < 0:
            t = (split_x - p1[0]) / (p2[0] - p1[0])
            y = p1[1] + t * (p2[1] - p1[1])
            crossings.append((i, [split_x, y]))

    if len(crossings) == 2:
        i1, pt1 = crossings[0]
        i2, pt2 = crossings[1]
        poly_a = coords[:i1+1] + [pt1, pt2] + coords[i2+1:]
        poly_b = [pt1] + coords[i1+1:i2+1] + [pt2, pt1]
        if poly_a[0] != poly_a[-1]: poly_a.append(poly_a[0])
        if poly_b[0] != poly_b[-1]: poly_b.append(poly_b[0])

        avg_x_a = sum(p[0] for p in poly_a) / len(poly_a)
        avg_x_b = sum(p[0] for p in poly_b) / len(poly_b)

        hisar_poly = poly_a if avg_x_a < avg_x_b else poly_b
        hansi_poly = poly_b if avg_x_a < avg_x_b else poly_a

        hisar_feature["geometry"]["coordinates"] = [hisar_poly]
        hansi_feature = {
            "type": "Feature",
            "properties": {
                "dt_code": "396",
                "district": "Hansi",
                "st_code": "06",
                "year": "2024",
                "st_nm": "Haryana"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [hansi_poly]
            }
        }
        geojson_data["features"].append(hansi_feature)
        print("  Added Hansi polygon feature by partitioning Hisar. Total features:", len(geojson_data["features"]))

# Save haryana_districts.geojson in all required locations
for dest_dir in [DATA_DIR, PROJECT_ROOT / "src" / "assets" / "data", PROJECT_ROOT / "public" / "assets" / "data"]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with open(dest_dir / "haryana_districts.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)

print("  Saved haryana_districts.geojson")

# ============================================================================
# 6. UPDATE districts.json & regions.json
# ============================================================================
print("\n--- Updating districts.json & regions.json ---")
with open(DATA_DIR / "districts.json", "r", encoding="utf-8") as f:
    old_districts = json.load(f)

new_districts = []
for d in old_districts:
    code = str(d["district_code"])
    if code in DROPPED_GJ_CODES:
        continue
    if code in GJ_TO_HR:
        m = GJ_TO_HR[code]
        new_d = dict(d)
        new_d["district_name"] = m["haryana_district"]
        new_d["district_code"] = m["haryana_code"]
        new_d["region"] = m["haryana_region"]
        new_districts.append(new_d)

new_districts.sort(key=lambda x: x["district_name"])
with open(DATA_DIR / "districts.json", "w", encoding="utf-8") as f:
    json.dump(new_districts, f, indent=2)
with open(DATA_DIR / "regions.json", "w", encoding="utf-8") as f:
    json.dump(new_districts, f, indent=2)
print(f"  districts.json / regions.json written with {len(new_districts)} districts.")

# ============================================================================
# 7. UPDATE NSWLD-01.json (Step 6)
# ============================================================================
print("\n--- Updating NSWLD-01.json (6 Pilot Districts) ---")
with open(DATA_DIR / "NSWLD-01.json", "r", encoding="utf-8") as f:
    raw_01 = json.load(f)

new_01 = []
for r in raw_01:
    dc_raw = r.get("district_code")
    if dc_raw is None:
        continue
    code = str(dc_raw)
    if code in NSWLD_01_MAPPING:
        m = NSWLD_01_MAPPING[code]
        nr = dict(r)
        nr["district_name"] = m["haryana_district"]
        nr["district_code"] = m["haryana_code"]
        if "region" in nr: nr["region"] = m["haryana_region"]
        if "state" in nr: nr["state"] = "Haryana"
        new_01.append(nr)
    else:
        print("  WARNING: Unmapped code in NSWLD-01:", code)

with open(DATA_DIR / "NSWLD-01.json", "w", encoding="utf-8") as f:
    json.dump(new_01, f, indent=2)
print(f"  NSWLD-01.json: {len(new_01)} rows, unique codes: {len(set(r['district_code'] for r in new_01))}")

# ============================================================================
# 8. UPDATE OTHER PER-SHEET JSON FILES
# ============================================================================
sheets = [
    "NSWLD-02.json", "NSWLD-05.json", "NSWLD-10.json", "NSWLD-10_2.json",
    "NSWLD-12.json", "NSWLD-13.json", "NSWLD-17.json", "NSWLD-17_2.json",
    "NSWLD-compiled.json"
]

all_processed_sheets = {}

for s in sheets:
    path = DATA_DIR / s
    if not path.exists():
        continue
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)

    new_rows = []
    dropped_count = 0
    for r in rows:
        dc_raw = r.get("district_code")
        if dc_raw is None:
            continue
        code = str(dc_raw)
        if code in DROPPED_GJ_CODES:
            dropped_count += 1
            continue
        if code in GJ_TO_HR:
            m = GJ_TO_HR[code]
            nr = dict(r)
            nr["district_name"] = m["haryana_district"]
            nr["district_code"] = m["haryana_code"]
            if "region" in nr: nr["region"] = m["haryana_region"]
            if "state" in nr: nr["state"] = "Haryana"
            new_rows.append(nr)
        else:
            new_rows.append(r)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(new_rows, f, indent=2)
    all_processed_sheets[s] = new_rows
    codes = set(r["district_code"] for r in new_rows if "district_code" in r)
    print(f"  {s:22s}: {len(new_rows):6d} rows (dropped {dropped_count:5d}), unique district_codes: {len(codes)}")

# ============================================================================
# 9. UPDATE STATE-LEVEL SHEETS
# ============================================================================
state_sheets = ["NSWLD-08.json", "NSWLD-29.json", "NSWLD-30.json", "NSWLD-34.json"]
for s in state_sheets:
    path = DATA_DIR / s
    if not path.exists():
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = json.load(f)
    txt = json.dumps(content)
    txt = txt.replace("Gujarat", "Haryana").replace("GUJARAT", "HARYANA")
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    print(f"  {s:22s}: checked state level sheet")

# ============================================================================
# 10. UPDATE compiled-district FOLDER
# ============================================================================
print("\n--- Updating compiled-district folder ---")
cd_dir = DATA_DIR / "compiled-district"
if cd_dir.exists():
    for f in list(cd_dir.glob("*.json")):
        code = f.stem
        if code in DROPPED_GJ_CODES:
            f.unlink()
        elif code in GJ_TO_HR:
            m = GJ_TO_HR[code]
            with open(f, "r", encoding="utf-8") as fp:
                items = json.load(fp)
            for it in items:
                if "id" in it and isinstance(it["id"], str):
                    parts = it["id"].split("-", 1)
                    if len(parts) == 2:
                        it["id"] = f"{m['haryana_code']}-{parts[1]}"
                if "block_name" in it and isinstance(it["block_name"], str):
                    it["block_name"] = it["block_name"].replace(m["gujarat_district"], m["haryana_district"].upper())
            target_file = cd_dir / f"{m['haryana_code']}.json"
            with open(target_file, "w", encoding="utf-8") as fp:
                json.dump(items, fp, indent=2)
            if target_file != f:
                f.unlink()
    remaining_files = list(cd_dir.glob("*.json"))
    print(f"  compiled-district: {len(remaining_files)} district files now present.")

# ============================================================================
# 11. UPDATE compiled-region-district-rollup.json
# ============================================================================
print("\n--- Updating compiled-region-district-rollup.json ---")
rollup_path = DATA_DIR / "compiled-region-district-rollup.json"
if rollup_path.exists():
    with open(rollup_path, "r", encoding="utf-8") as f:
        old_rollup = json.load(f)

    # Extract surviving district rows
    new_dist_rows = []
    for r in old_rollup:
        if r.get("level") == "district":
            code = str(r.get("dist_code"))
            if code in DROPPED_GJ_CODES:
                continue
            if code in GJ_TO_HR:
                m = GJ_TO_HR[code]
                nr = dict(r)
                nr["name"] = m["haryana_district"]
                nr["dist_code"] = m["haryana_code"]
                nr["region"] = m["haryana_region"]
                new_dist_rows.append(nr)

    new_dist_rows.sort(key=lambda x: x["name"])

    # Recompute regions
    haryana_regions_list = ["Ambala", "Faridabad", "Gurugram", "Hisar", "Karnal", "Rohtak"]
    region_rows = []
    for reg in sorted(haryana_regions_list):
        dists = [d for d in new_dist_rows if d["region"] == reg]
        fem_apr = sum(d.get("female_apr", 0) for d in dists)
        male_apr = sum(d.get("male_apr", 0) for d in dists)
        fem_oct = sum(d.get("female_oct", 0) for d in dists)
        male_oct = sum(d.get("male_oct", 0) for d in dists)
        fem_delta = fem_apr - fem_oct
        male_delta = male_apr - male_oct
        total_delta = fem_delta + male_delta
        region_rows.append({
            "level": "region",
            "name": reg,
            "region": reg,
            "dist_code": None,
            "female_apr": fem_apr,
            "male_apr": male_apr,
            "female_oct": fem_oct,
            "male_oct": male_oct,
            "female_delta": fem_delta,
            "male_delta": male_delta,
            "total_delta": total_delta
        })

    # Recompute state
    tot_fem_apr = sum(d.get("female_apr", 0) for d in new_dist_rows)
    tot_male_apr = sum(d.get("male_apr", 0) for d in new_dist_rows)
    tot_fem_oct = sum(d.get("female_oct", 0) for d in new_dist_rows)
    tot_male_oct = sum(d.get("male_oct", 0) for d in new_dist_rows)
    tot_fem_delta = tot_fem_apr - tot_fem_oct
    tot_male_delta = tot_male_apr - tot_male_oct
    tot_total_delta = tot_fem_delta + tot_male_delta
    state_row = [{
        "level": "state",
        "name": "Haryana",
        "region": None,
        "dist_code": None,
        "female_apr": tot_fem_apr,
        "male_apr": tot_male_apr,
        "female_oct": tot_fem_oct,
        "male_oct": tot_male_oct,
        "female_delta": tot_fem_delta,
        "male_delta": tot_male_delta,
        "total_delta": tot_total_delta
    }]

    new_rollup = state_row + region_rows + new_dist_rows
    with open(rollup_path, "w", encoding="utf-8") as f:
        json.dump(new_rollup, f, indent=2)
    print(f"  compiled-region-district-rollup.json updated with {len(new_rollup)} total rows.")

# ============================================================================
# 12. UPDATE NSWLD-overview-aggregates.json
# ============================================================================
print("\n--- Updating NSWLD-overview-aggregates.json ---")
overview_path = DATA_DIR / "NSWLD-overview-aggregates.json"
if overview_path.exists():
    with open(overview_path, "r", encoding="utf-8") as f:
        oa = json.load(f)

    # 1. Active Anganwadis
    total_aw_rural = sum(d.get("no_of_aw_rural", 0) for d in new_districts)
    total_aw_urban = sum(d.get("no_of_aw_urban", 0) for d in new_districts)
    oa["active_anganwadis"] = {
        "total": total_aw_rural + total_aw_urban,
        "rural": total_aw_rural,
        "urban": total_aw_urban
    }

    # 2. AYUSH THR % by district (6 pilot districts)
    dist_ayush = defaultdict(lambda: {"actual": 0, "target": 0})
    for r in new_01:
        if r.get("district_name"):
            if r.get("actual") is not None:
                dist_ayush[r["district_name"]]["actual"] += r["actual"]
            if r.get("target") is not None:
                dist_ayush[r["district_name"]]["target"] += r["target"]
    ayush_by_district = []
    for dist, vals in dist_ayush.items():
        pct = round(vals["actual"] / vals["target"] * 100, 2) if vals["target"] > 0 else 0
        ayush_by_district.append({"district_name": dist, "pct": pct})
    ayush_by_district.sort(key=lambda x: x["pct"], reverse=True)
    oa["ayush_thr_pct_by_district"] = ayush_by_district

    # 3. Vahali Dikari by district (23 districts)
    vahali_rows = all_processed_sheets["NSWLD-10_2.json"]
    dist_vahali = defaultdict(lambda: {"total": 0, "district_code": None})
    for r in vahali_rows:
        dn = r.get("district_name")
        if dn and r.get("actual") is not None:
            dist_vahali[dn]["total"] += r["actual"]
            dist_vahali[dn]["district_code"] = r.get("district_code")
    vahali_by_district = []
    for dist, vals in sorted(dist_vahali.items()):
        vahali_by_district.append({
            "district_name": dist,
            "district_name_topo": dist,
            "district_code": vals["district_code"],
            "total": vals["total"]
        })
    vahali_by_district.sort(key=lambda x: x["total"], reverse=True)
    oa["vahali_dikari_by_district"] = vahali_by_district

    # 4. District name map
    oa["district_name_map"] = {d["district_name"]: d["district_name"] for d in new_districts}

    # Total vahali
    oa["total_vahali_dikari_beneficiaries_all_time"] = sum(v["total"] for v in vahali_by_district)

    # Total BBBP programs
    bbbp_rows = all_processed_sheets["NSWLD-10.json"]
    oa["total_bbbp_programs_all_time"] = sum(r["actual_programs"] for r in bbbp_rows if r.get("actual_programs") is not None)

    # Monthly BBBP spread
    MONTH_NAMES_FY_ORDER = [
        "April", "May", "June", "July", "August", "September",
        "October", "November", "December", "January", "February", "March"
    ]
    monthly_bbbp = defaultdict(int)
    for r in bbbp_rows:
        if r.get("actual_programs") is not None and r.get("month"):
            monthly_bbbp[r["month"].upper()] += r["actual_programs"]
    oa["monthly_bbbp_spread"] = [
        {"month": m, "total_programs": monthly_bbbp.get(m.upper(), 0)}
        for m in MONTH_NAMES_FY_ORDER
    ]

    # Girls registered vs trained by FY
    girls_rows = all_processed_sheets["NSWLD-12.json"]
    fy_girls_data = defaultdict(lambda: {"registered_sum": 0, "trained_sum": 0, "months": set()})
    for r in girls_rows:
        fy = r.get("fy")
        m = r.get("month")
        if fy:
            if r.get("actual_trained") is not None:
                fy_girls_data[fy]["trained_sum"] += r["actual_trained"]
                if m:
                    fy_girls_data[fy]["months"].add(m.upper())
            if r.get("target_registered") is not None:
                fy_girls_data[fy]["registered_sum"] += r["target_registered"]

    girls_by_fy = []
    for fy in sorted(fy_girls_data.keys()):
        month_cnt = len(fy_girls_data[fy]["months"]) or 12
        avg_reg_mo = fy_girls_data[fy]["registered_sum"] / month_cnt
        avg_tr_mo = fy_girls_data[fy]["trained_sum"] / month_cnt
        pct = round(avg_tr_mo / avg_reg_mo * 100, 2) if avg_reg_mo > 0 else 0
        girls_by_fy.append({
            "fy": fy,
            "registered": round(avg_reg_mo, 2),
            "trained": round(avg_tr_mo, 2),
            "registered_lakh": round(avg_reg_mo / 100000, 2),
            "trained_lakh": round(avg_tr_mo / 100000, 2),
            "pct_trained": pct
        })
    oa["girls_registered_vs_trained_by_fy"] = girls_by_fy

    # Current FY (2025-26) avg girls trained
    sum_trained_2025_26 = sum(
        r["actual_trained"] for r in girls_rows
        if r.get("fy") == "2025-26" and r.get("actual_trained") is not None
    )
    oa["avg_girls_trained_per_month_current_fy"] = round(sum_trained_2025_26 / 12, 2)

    with open(overview_path, "w", encoding="utf-8") as f:
        json.dump(oa, f, indent=2)
    print("  NSWLD-overview-aggregates.json updated.")

print("\n--- ALL DATA UPDATES COMPLETED SUCCESSFULLY ---")
