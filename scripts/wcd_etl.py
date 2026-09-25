"""
WCD ETL Script — Women & Child Development Department Dashboard
================================================================
Reads WCD_templates.xlsx and produces JSON files for the React dashboard.

Source sheets: NSWLD-01, NSWLD-02, NSWLD-05, NSWLD-08, NSWLD-10, NSWLD-10_2,
              NSWLD-12, NSWLD-13, NSWLD-17, NSWLD-17(2), NSWLD-29, NSWLD-30,
              NSWLD-34, compiled

Outputs:
  1. districts.json         — deduplicated district master (from NSWLD-12)
  2. NSWLD-01.json          — AYUSH THR (6 pilot districts)
  3. NSWLD-02.json          — Mangal Diwas
  4. NSWLD-05.json          — Working Women Hostels
  5. NSWLD-08.json          — 181 Helpline
  6. NSWLD-10.json          — BBBP Awareness Programs
  7. NSWLD-10_2.json        — Vahali Dikari Yojana
  8. NSWLD-12.json          — Adolescent Girls Training
  9. NSWLD-13.json          — Poshan Tracker
 10. NSWLD-17.json          — Mahila Swavlamban Yojana
 11. NSWLD-17_2.json        — Mahila Jagruti Shibirs (source sheet: NSWLD-17(2))
 12. NSWLD-29.json          — Gender Sensitization State Level
 13. NSWLD-30.json          — SETU Gender Sensitization
 14. NSWLD-34.json          — Sexual Harassment Act Sensitization
 15. NSWLD-compiled.json    — Anganwadi data pre-aggregated to district+month
 16. wcdConfig.json         — Static config (interventions, actionableSteps, kpis)
 17. NSWLD-overview-aggregates.json — Derived KPIs for the Overview page
"""

import json
import math
import openpyxl
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
EXCEL_PATH = PROJECT_ROOT / "WCD_templates.xlsx"
REGION_MAP_PATH = PROJECT_ROOT / "haryana_region_mapping.json"
OUT_DIR = PROJECT_ROOT / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
NULL_VARIANTS = {"-", "NA", "na", "Na", "N/A", "n/a", "", "NULL", "None", "none"}

def clean_str(v):
    """Normalize whitespace in strings, return None for null variants."""
    if v is None:
        return None
    s = str(v).strip()
    if s in NULL_VARIANTS:
        return None
    return " ".join(s.split())

def clean_num(v):
    """Convert to float/int, return None for null variants."""
    if v is None:
        return None
    s = str(v).strip()
    if s in NULL_VARIANTS:
        return None
    try:
        val = float(s)
        if math.isnan(val):
            return None
        if val == int(val):
            return int(val)
        return round(val, 4)
    except (ValueError, TypeError):
        return None

def clean_int(v):
    """Convert to int, return None for null variants."""
    n = clean_num(v)
    if n is None:
        return None
    return int(n)

# Spelling variants across sheets (e.g. DOHAD in NSWLD-10_2 vs DAHOD in NSWLD-01)
DISTRICT_SPELLING_NORMALIZE = {
    "DOHAD": "DAHOD",
}

def normalize_district(name):
    """Normalize district name: uppercase, trim, collapse whitespace, fix known variants."""
    if name is None:
        return None
    normalized = " ".join(str(name).strip().upper().split())
    return DISTRICT_SPELLING_NORMALIZE.get(normalized, normalized)

def read_sheet(wb, sheet_name):
    """Read a sheet into a list of dicts using the first row as headers."""
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h else f"col_{i}" for i, h in enumerate(rows[0])]
    while headers and headers[-1].startswith("col_"):
        headers.pop()
    data = []
    for row in rows[1:]:
        record = {}
        for i, h in enumerate(headers):
            record[h] = row[i] if i < len(row) else None
        data.append(record)
    return data

def write_json(filename, data):
    """Write data to JSON file in the output directory."""
    path = OUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    return path

# ---------------------------------------------------------------------------
# Month ordering (fiscal year: Apr=1, Mar=12)
# ---------------------------------------------------------------------------
MONTH_ORDER = {
    "APRIL": 1, "MAY": 2, "JUNE": 3, "JULY": 4,
    "AUGUST": 5, "SEPTEMBER": 6, "OCTOBER": 7, "NOVEMBER": 8,
    "DECEMBER": 9, "JANUARY": 10, "FEBRUARY": 11, "MARCH": 12,
}
MONTH_NAMES_FY_ORDER = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March"
]

# District name mapping: data names (uppercase) -> TopoJSON names (Census)
DISTRICT_NAME_MAP = {
    "AHMADABAD": "Ahmedabad",
    "AMRELI": "Amreli",
    "ANAND": "Anand",
    "ARVALLI": "Aravalli",
    "BANAS KANTHA": "Banaskantha",
    "BHARUCH": "Bharuch",
    "BHAVNAGAR": "Bhavnagar",
    "BOTAD": "Botad",
    "CHHOTAUDEPUR": "Chhota Udaipur",
    "DAHOD": "Dahod",
    "DANG": "Dang",
    "DEVBHUMI DWARKA": "Devbhumi Dwarka",
    "GANDHINAGAR": "Gandhinagar",
    "GIR SOMNATH": "Gir Somnath",
    "JAMNAGAR": "Jamnagar",
    "JUNAGADH": "Junagadh",
    "KACHCHH": "Kutch",
    "KHEDA": "Kheda",
    "MAHESANA": "Mehsana",
    "MORBI": "Morbi",
    "MAHISAGAR": "Mahisagar",
    "NARMADA": "Narmada",
    "NAVSARI": "Navsari",
    "PANCH MAHALS": "Panchmahal",
    "PATAN": "Patan",
    "PORBANDAR": "Porbandar",
    "RAJKOT": "Rajkot",
    "SABAR KANTHA": "Sabarkantha",
    "SURAT": "Surat",
    "SURENDRANAGAR": "Surendranagar",
    "TAPI": "Tapi",
    "VADODARA": "Vadodara",
    "VALSAD": "Valsad",
}

# ===========================================================================
# MAIN
# ===========================================================================
print("Loading workbook...")
wb = openpyxl.load_workbook(str(EXCEL_PATH), read_only=True, data_only=True)
print(f"Sheets found: {wb.sheetnames}")

# ===========================================================================
# 1. districts.json — from NSWLD-12 (has all 33 districts with AW counts)
# ===========================================================================
print("\n--- Processing districts.json (from NSWLD-12) ---")
raw_12 = read_sheet(wb, "NSWLD-12")
districts_map = {}
for row in raw_12:
    dc = clean_str(row.get("district_code"))
    if dc is None:
        continue
    if dc not in districts_map:
        districts_map[dc] = {
            "district_name": normalize_district(row.get("district_name")),
            "district_code": dc,
            "no_of_taluka": clean_int(row.get("No_of_Taluka")),
            "no_of_ward": clean_int(row.get("No_of_ward")),
            "no_of_village_ward": clean_int(row.get("No_of_Village_ward")),
            "no_of_aw_urban": clean_int(row.get("No_of_AW_Urban")),
            "no_of_aw_rural": clean_int(row.get("L No_of_AW_rural")),
        }

print("Loading haryana_region_mapping.json...")
with open(str(REGION_MAP_PATH), "r", encoding="utf-8") as f_reg:
    region_rows = json.load(f_reg)
region_dict = {}
for r in region_rows:
    if r.get("District_Code") is not None:
        region_dict[str(r["District_Code"]).strip()] = clean_str(r.get("Region"))

districts_list = sorted(districts_map.values(), key=lambda d: d["district_name"] or "")

# Add region to districts
for d in districts_list:
    d["region"] = region_dict.get(d["district_code"])

write_json("districts.json", districts_list)
write_json("regions.json", districts_list)
print(f"  districts.json / regions.json: {len(districts_list)} districts with regions")

# ===========================================================================
# 2. NSWLD-01.json — AYUSH THR (6 pilot districts)
# ===========================================================================
print("\n--- Processing NSWLD-01.json ---")
raw_01 = read_sheet(wb, "NSWLD-01")
nswld_01 = []
for row in raw_01:
    nswld_01.append({
        "intervention_code": "NSWLD-01",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "month": clean_str(row.get("Month")),
        "target": clean_num(row.get("Target_No_of_pregnant_and_lactating_mother_receiving_AYUSH_THR")),
        "actual": clean_num(row.get("Actual_No_of_pregnant_and_lactating_mother_receiving_AYUSH_THR")),
    })
write_json("NSWLD-01.json", nswld_01)
print(f"  NSWLD-01.json: {len(nswld_01)} rows")

# ===========================================================================
# 3. NSWLD-02.json — Mangal Diwas
# ===========================================================================
print("\n--- Processing NSWLD-02.json ---")
raw_02 = read_sheet(wb, "NSWLD-02")
nswld_02 = []
for row in raw_02:
    nswld_02.append({
        "intervention_code": "NSWLD-02",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "quarter": clean_str(row.get("Quarter")),
        "target": clean_num(row.get("target_No_of_beneficiaries_covered_under_mangal_diwas")),
        "actual": clean_num(row.get("actual_No_of_beneficiaries_covered_under_mangal_diwas")),
        "remarks": clean_str(row.get("REMARKS ")),
    })
write_json("NSWLD-02.json", nswld_02)
print(f"  NSWLD-02.json: {len(nswld_02)} rows")

# ===========================================================================
# 4. NSWLD-05.json — Working Women Hostels
# ===========================================================================
print("\n--- Processing NSWLD-05.json ---")
raw_05 = read_sheet(wb, "NSWLD-05")
nswld_05 = []
for row in raw_05:
    nswld_05.append({
        "intervention_code": "NSWLD-05",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("Year")),
        "half_year": clean_str(row.get("Half Year")),
        "target_hostels": clean_num(row.get("target_Number_of_Working_Women_Hostels_with_day_care_facilities")),
        "actual_hostels": clean_num(row.get("actual_Number_of_Working_Women_Hostels_with_day_care_facilities")),
        "land_alloted": clean_str(row.get("land_alloted_boolean")),
        "work_order_issued": clean_str(row.get("work_order_issued_boolean")),
        "construction_in_progress": clean_str(row.get("construction_in_progress_boolean")),
        "operational_hostel": clean_str(row.get("operational_hostel_boolean")),
    })
write_json("NSWLD-05.json", nswld_05)
print(f"  NSWLD-05.json: {len(nswld_05)} rows")

# ===========================================================================
# 5. NSWLD-08.json — 181 Helpline
# ===========================================================================
print("\n--- Processing NSWLD-08.json ---")
raw_08 = read_sheet(wb, "NSWLD-08")
nswld_08 = []
for row in raw_08:
    nswld_08.append({
        "intervention_code": "NSWLD-08",
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "month": clean_str(row.get("Month")),
        "target_response_time": clean_str(row.get("target_response_time_under_181_helpline_annual")),
        "actual_response_time": clean_str(row.get("actual_response_time_under_181_helpline")),
        "target_rescue_vans": clean_num(row.get("target_No_of_rescue_vans")),
        "actual_rescue_vans": clean_num(row.get("actual_No_of_rescue_vans")),
    })
write_json("NSWLD-08.json", nswld_08)
print(f"  NSWLD-08.json: {len(nswld_08)} rows")

# ===========================================================================
# 6. NSWLD-10.json — BBBP Awareness Programs
# ===========================================================================
print("\n--- Processing NSWLD-10.json ---")
raw_10 = read_sheet(wb, "NSWLD-10")
nswld_10 = []
for row in raw_10:
    nswld_10.append({
        "intervention_code": "NSWLD-10",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "month": clean_str(row.get("Month")),
        "target_programs": clean_num(row.get("target_No_of_awarness_programs_under_Beti_Bachoa_Beti_Padhao")),
        "actual_programs": clean_num(row.get("actual_No_of_awarness_programs_under_Beti_Bachoa_Beti_Padhao")),
        "target_participants": clean_num(row.get("target_No_of_participants_of_awareness_session_under_Beti_Bachao_and_Beti_Padhao")),
        "actual_participants": clean_num(row.get("actual_No_of_participants_of_awareness_session_under_Beti_Bachao_and_Beti_Padhao")),
    })
write_json("NSWLD-10.json", nswld_10)
print(f"  NSWLD-10.json: {len(nswld_10)} rows")

# ===========================================================================
# 7. NSWLD-10_2.json — Vahali Dikari Yojana
# ===========================================================================
print("\n--- Processing NSWLD-10_2.json ---")
raw_10_2 = read_sheet(wb, "NSWLD-10_2")
nswld_10_2 = []
for row in raw_10_2:
    nswld_10_2.append({
        "intervention_code": "NSWLD-10_2",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "month": clean_str(row.get("Month")),
        "target": clean_num(row.get("target_No_of_beneficiaries_of_Vahali_Dikari_Yojana")),
        "actual": clean_num(row.get("actual_No_of_beneficiaries_of_Vahali_Dikari_Yojana")),
    })
write_json("NSWLD-10_2.json", nswld_10_2)
print(f"  NSWLD-10_2.json: {len(nswld_10_2)} rows")

# ===========================================================================
# 8. NSWLD-12.json — Adolescent Girls Training
# ===========================================================================
print("\n--- Processing NSWLD-12.json ---")
nswld_12 = []
for row in raw_12:
    nswld_12.append({
        "intervention_code": "NSWLD-12",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("Year")),
        "month": clean_str(row.get("Month")),
        "target_registered": clean_num(row.get("target_Number_of_adolescent_girls_registered_with_anganwadi_centers_to_attend_the_sessions_on_nutrition,_education_and_life_skills")),
        "actual_trained": clean_num(row.get("actual_Number_of_adolescent_girls_trained_with_anganwadi_centers")),
        "target_trainers": clean_num(row.get("target_Number_of_Trainers_to_be_trained")),
        "actual_trainers": clean_num(row.get("actual_Number_of_Trainers_trained")),
    })
write_json("NSWLD-12.json", nswld_12)
print(f"  NSWLD-12.json: {len(nswld_12)} rows")

# ===========================================================================
# 9. NSWLD-13.json — Poshan Tracker
# ===========================================================================
print("\n--- Processing NSWLD-13.json ---")
raw_13 = read_sheet(wb, "NSWLD-13")
nswld_13 = []
for row in raw_13:
    nswld_13.append({
        "intervention_code": "NSWLD-13",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("Year")),
        "month": clean_str(row.get("Month")),
        "target_children_registered": clean_num(row.get("Target_No_of_children_registered_on_Poshan_Tracker_0_5_years")),
        "actual_children_registered": clean_num(row.get("Actual_No_of_children_registered_on_Poshan_Tracker_0_5_years")),
        "development_tracking": clean_str(row.get("Development_of_tracking_mechanism\n_of_gender_disaggregated_data")),
        "male_sam": clean_num(row.get("Male_SAM")),
        "female_sam": clean_num(row.get("Female_SAM")),
        "target_nutrition_diff": clean_num(row.get("Target_difference_in_male_and_female_Nutrition_levels")),
        "actual_nutrition_diff": clean_num(row.get("Actual_difference_in_male_and_female_Nutrition_levels")),
    })
write_json("NSWLD-13.json", nswld_13)
print(f"  NSWLD-13.json: {len(nswld_13)} rows")

# ===========================================================================
# 10. NSWLD-17.json — Mahila Swavlamban Yojana
# ===========================================================================
print("\n--- Processing NSWLD-17.json ---")
raw_17 = read_sheet(wb, "NSWLD-17")
nswld_17 = []
for row in raw_17:
    nswld_17.append({
        "intervention_code": "NSWLD-17",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "target_beneficiaries": clean_num(row.get("Target_No_of_beneficiaries_receiving_subsidies_under_Mahila_Swavlamban_Yojana")),
        "actual_beneficiaries": clean_num(row.get("Actual_No_of_beneficiaries_receiving_subsidies_under_Mahila_Swavlamban_Yojana")),
        "target_subsidy_amount": clean_num(row.get("Target_Subsidy_amt_disbursed_under_Mahila_Swavlamban_Yojana_rs")),
        "actual_subsidy_amount": clean_num(row.get("Actual_Subsidy_amt_disbursed_under_Mahila_Swavlamban_Yojana_rs")),
    })
write_json("NSWLD-17.json", nswld_17)
print(f"  NSWLD-17.json: {len(nswld_17)} rows")

# ===========================================================================
# 11. NSWLD-17_2.json — Mahila Jagruti Shibirs (source: NSWLD-17(2))
# ===========================================================================
print("\n--- Processing NSWLD-17_2.json (from sheet NSWLD-17(2)) ---")
raw_17_2 = read_sheet(wb, "NSWLD-17(2)")
nswld_17_2 = []
for row in raw_17_2:
    nswld_17_2.append({
        "intervention_code": "NSWLD-17_2",
        "district_name": normalize_district(row.get("district_name")),
        "district_code": clean_str(row.get("district_code")),
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "target_sessions": clean_num(row.get("Target no of Jagruti shibir sessions conducted")),
        "actual_sessions": clean_num(row.get("Actual no of Jagruti shibir sessions conducted")),
        "target_participants": clean_num(row.get("Target_no_of_participants_from_Mahila_Jagruti_Shibirs")),
        "actual_participants": clean_num(row.get("Actual_no_of_participants_from_Mahila_Jagruti_Shibirs")),
        "actual_champions": clean_num(row.get("Actual no of Champion identified per district")),
    })
write_json("NSWLD-17_2.json", nswld_17_2)
print(f"  NSWLD-17_2.json: {len(nswld_17_2)} rows")

# ===========================================================================
# 12. NSWLD-29.json — Gender Sensitization State Level
# ===========================================================================
print("\n--- Processing NSWLD-29.json ---")
raw_29 = read_sheet(wb, "NSWLD-29")
nswld_29 = []
for row in raw_29:
    nswld_29.append({
        "intervention_code": "NSWLD-29",
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "quarter": clean_str(row.get("Quarter")),
        "target_programs": clean_num(row.get("Target_No_of_sensitization_programs_conducted_at_state_level_departments")),
        "actual_programs": clean_num(row.get("Actual_No_of_sensitization_programs_conducted_at_state_level_departments")),
        "target_participants": clean_num(row.get("Target_No_of_participants_attending_these_gender_sensitization_programs")),
        "actual_participants": clean_num(row.get("Actual_No_of_participants_attending_these_gender_sensitization_programs")),
    })
write_json("NSWLD-29.json", nswld_29)
print(f"  NSWLD-29.json: {len(nswld_29)} rows")

# ===========================================================================
# 13. NSWLD-30.json — SETU Gender Sensitization
# ===========================================================================
print("\n--- Processing NSWLD-30.json ---")
raw_30 = read_sheet(wb, "NSWLD-30")
nswld_30 = []
for row in raw_30:
    nswld_30.append({
        "intervention_code": "NSWLD-30",
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "quarter": clean_str(row.get("Quarter")),
        "target": clean_num(row.get("Target_No_of_people_participating_in_the_gender_sensitization_awareness_programmes_conducted_through_SETU")),
        "actual": clean_num(row.get("Actual_No_of_people_participating_in_the_gender_sensitization_awareness_programmes_conducted_through_SETU")),
    })
write_json("NSWLD-30.json", nswld_30)
print(f"  NSWLD-30.json: {len(nswld_30)} rows")

# ===========================================================================
# 14. NSWLD-34.json — Sexual Harassment Act Sensitization
# ===========================================================================
print("\n--- Processing NSWLD-34.json ---")
raw_34 = read_sheet(wb, "NSWLD-34")
nswld_34 = []
for row in raw_34:
    nswld_34.append({
        "intervention_code": "NSWLD-34",
        "periodicity": clean_str(row.get("Periodicity")),
        "fy": clean_str(row.get("FY")),
        "quarter": clean_str(row.get("Quarter")),
        "target": clean_num(row.get("Target_no_of_officers_and_employees_sensitized_in_govt_offices_regarding_Sexual_Harassment_Act_2013")),
        "actual": clean_num(row.get("Actual_no_of_officers_and_employees_sensitized_in_govt_offices_regarding_Sexual_Harassment_Act_2013")),
    })
write_json("NSWLD-34.json", nswld_34)
print(f"  NSWLD-34.json: {len(nswld_34)} rows")

def build_compiled_outputs(wb, region_dict, districts_map):
    """
    Build granular rollups for 'compiled' sheet SAM data (Step 1):
      - compiled-region-district-rollup.json (40 flat rows: 1 state + 6 region + 33 district)
      - compiled-district/{dist_code}.json (33 per-district files containing pivoted anganwadis)
    """
    print("\n--- Processing compiled-region-district-rollup.json & per-district JSONs (Step 1) ---")
    raw_compiled = read_sheet(wb, "compiled")
    
    APRIL_VAL = '2025-04-01 00:00:00'
    OCTOBER_VAL = '2025-10-01 00:00:00'

    # Pivot per physical anganwadi: key = (dist_code, Block_Name, Sector_Name, Anganwadi_Name)
    anganwadi_pivot = defaultdict(lambda: {
        "female_apr": 0, "male_apr": 0,
        "female_oct": 0, "male_oct": 0
    })

    for row in raw_compiled:
        month_val = row.get("Month")
        if month_val is None:
            continue
        month_str = str(month_val).strip()
        if month_str not in (APRIL_VAL, OCTOBER_VAL):
            continue

        dc = clean_str(row.get("dist_code"))
        if not dc:
            continue

        block = clean_str(row.get("Block_Name")) or ""
        sector = clean_str(row.get("Sector_Name")) or ""
        aw = clean_str(row.get("Anganwadi_Name")) or ""

        female = clean_int(row.get("Female")) or 0
        male = clean_int(row.get("Male")) or 0

        key = (dc, block, sector, aw)
        if month_str == APRIL_VAL:
            anganwadi_pivot[key]["female_apr"] = female
            anganwadi_pivot[key]["male_apr"] = male
        elif month_str == OCTOBER_VAL:
            anganwadi_pivot[key]["female_oct"] = female
            anganwadi_pivot[key]["male_oct"] = male

    # Organize anganwadi records per district
    district_anganwadis = defaultdict(list)
    for (dc, block, sector, aw), vals in anganwadi_pivot.items():
        f_apr = vals["female_apr"]
        m_apr = vals["male_apr"]
        f_oct = vals["female_oct"]
        m_oct = vals["male_oct"]
        f_delta = f_apr - f_oct
        m_delta = m_apr - m_oct
        t_delta = f_delta + m_delta

        district_anganwadis[dc].append({
            "block_name": block,
            "anganwadi_name": aw,
            "female_apr": f_apr,
            "male_apr": m_apr,
            "female_oct": f_oct,
            "male_oct": m_oct,
            "female_delta": f_delta,
            "male_delta": m_delta,
            "total_delta": t_delta
        })

    # Write OUTPUT 2: public/data/compiled-district/{dist_code}.json (33 files)
    compiled_dist_dir = OUT_DIR / "compiled-district"
    compiled_dist_dir.mkdir(parents=True, exist_ok=True)

    for dc, aw_list in district_anganwadis.items():
        aw_list.sort(key=lambda x: (x["block_name"], x["anganwadi_name"]))
        district_file_rows = []
        for idx, item in enumerate(aw_list, start=1):
            district_file_rows.append({
                "id": f"{dc}-{idx}",
                "block_name": item["block_name"],
                "anganwadi_name": item["anganwadi_name"],
                "female_apr": item["female_apr"],
                "male_apr": item["male_apr"],
                "female_oct": item["female_oct"],
                "male_oct": item["male_oct"],
                "female_delta": item["female_delta"],
                "male_delta": item["male_delta"],
                "total_delta": item["total_delta"]
            })
        file_path = compiled_dist_dir / f"{dc}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(district_file_rows, f, indent=2, ensure_ascii=False)

    # Compute district rollups
    district_rollups = {}
    for dc, aw_list in district_anganwadis.items():
        f_apr = sum(item["female_apr"] for item in aw_list)
        m_apr = sum(item["male_apr"] for item in aw_list)
        f_oct = sum(item["female_oct"] for item in aw_list)
        m_oct = sum(item["male_oct"] for item in aw_list)
        f_delta = f_apr - f_oct
        m_delta = m_apr - m_oct
        t_delta = f_delta + m_delta

        d_info = districts_map.get(dc, {})
        d_name = d_info.get("district_name") or dc
        reg_name = region_dict.get(dc)

        district_rollups[dc] = {
            "level": "district",
            "name": d_name,
            "region": reg_name,
            "dist_code": dc,
            "female_apr": f_apr,
            "male_apr": m_apr,
            "female_oct": f_oct,
            "male_oct": m_oct,
            "female_delta": f_delta,
            "male_delta": m_delta,
            "total_delta": t_delta
        }

    # Region rollups
    region_rollups = defaultdict(lambda: {
        "female_apr": 0, "male_apr": 0,
        "female_oct": 0, "male_oct": 0
    })
    for d_row in district_rollups.values():
        reg = d_row["region"]
        region_rollups[reg]["female_apr"] += d_row["female_apr"]
        region_rollups[reg]["male_apr"] += d_row["male_apr"]
        region_rollups[reg]["female_oct"] += d_row["female_oct"]
        region_rollups[reg]["male_oct"] += d_row["male_oct"]

    region_rows_list = []
    for reg_name in sorted(region_rollups.keys()):
        vals = region_rollups[reg_name]
        f_apr = vals["female_apr"]
        m_apr = vals["male_apr"]
        f_oct = vals["female_oct"]
        m_oct = vals["male_oct"]
        f_delta = f_apr - f_oct
        m_delta = m_apr - m_oct
        t_delta = f_delta + m_delta
        region_rows_list.append({
            "level": "region",
            "name": reg_name,
            "region": reg_name,
            "dist_code": None,
            "female_apr": f_apr,
            "male_apr": m_apr,
            "female_oct": f_oct,
            "male_oct": m_oct,
            "female_delta": f_delta,
            "male_delta": m_delta,
            "total_delta": t_delta
        })

    # State rollup
    s_f_apr = sum(d["female_apr"] for d in district_rollups.values())
    s_m_apr = sum(d["male_apr"] for d in district_rollups.values())
    s_f_oct = sum(d["female_oct"] for d in district_rollups.values())
    s_m_oct = sum(d["male_oct"] for d in district_rollups.values())
    s_f_delta = s_f_apr - s_f_oct
    s_m_delta = s_m_apr - s_m_oct
    s_t_delta = s_f_delta + s_m_delta

    state_row = {
        "level": "state",
        "name": "Gujarat",
        "region": None,
        "dist_code": None,
        "female_apr": s_f_apr,
        "male_apr": s_m_apr,
        "female_oct": s_f_oct,
        "male_oct": s_m_oct,
        "female_delta": s_f_delta,
        "male_delta": s_m_delta,
        "total_delta": s_t_delta
    }

    dist_rows_list = sorted(district_rollups.values(), key=lambda x: x["name"])

    # OUTPUT 1: public/data/compiled-region-district-rollup.json
    flat_rollup = [state_row] + region_rows_list + dist_rows_list
    write_json("compiled-region-district-rollup.json", flat_rollup)

    # Verification printing
    print(f"  compiled-region-district-rollup.json: {len(flat_rollup)} rows written")
    print(f"  compiled-district/*.json: {len(district_anganwadis)} files written")

    print("\n--- STEP 1 VERIFICATION OUTPUTS ---")
    print("\n1. STATE ROW:")
    print(json.dumps(state_row, indent=2))

    print(f"\n2. REGION ROWS ({len(region_rows_list)} total):")
    for r_row in region_rows_list:
        print(json.dumps(r_row))

    print(f"\n3. DISTRICT ROWS ({len(dist_rows_list)} total):")
    for d_row in dist_rows_list:
        print(json.dumps(d_row))

    sum_f_delta = sum(d["female_delta"] for d in dist_rows_list)
    sum_m_delta = sum(d["male_delta"] for d in dist_rows_list)
    print(f"\n4. SUM OF 33 DISTRICT DELTAS:")
    print(f"   female_delta sum: {sum_f_delta} (expected 5850)")
    print(f"   male_delta sum:   {sum_m_delta} (expected 8378)")

    sample_dc = sorted(district_anganwadis.keys())[0]
    sample_file = compiled_dist_dir / f"{sample_dc}.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        sample_data = json.load(f)

    print(f"\n5. SAMPLE PER-DISTRICT FILE FIRST 5 ROWS ({sample_file.name}):")
    print(json.dumps(sample_data[:5], indent=2))

    dist_files = list(compiled_dist_dir.glob("*.json"))
    print(f"\n6. TOTAL PER-DISTRICT FILES COUNT: {len(dist_files)} in {compiled_dist_dir}")


build_compiled_outputs(wb, region_dict, districts_map)

# ===========================================================================
# 16. wcdConfig.json — Static config
# ===========================================================================
print("\n--- Writing wcdConfig.json ---")
wcd_config = {
    "interventions": 11,
    "actionableSteps": 14,
    "kpis": 20
}
write_json("wcdConfig.json", wcd_config)
print(f"  wcdConfig.json: {json.dumps(wcd_config)}")

# ===========================================================================
# 17. NSWLD-overview-aggregates.json — Derived KPIs for Overview page
# ===========================================================================
print("\n--- Computing NSWLD-overview-aggregates.json ---")

# Avg girls trained/month, current FY (2025-26)
sum_trained_2025_26 = sum(
    r["actual_trained"] for r in nswld_12
    if r["fy"] == "2025-26" and r["actual_trained"] is not None
)
avg_girls_trained = round(sum_trained_2025_26 / 12, 2)
print(f"  Avg girls trained/month (2025-26): {avg_girls_trained}")

# Active Anganwadis (from deduped districts table)
total_aw_urban = sum(d["no_of_aw_urban"] or 0 for d in districts_list)
total_aw_rural = sum(d["no_of_aw_rural"] or 0 for d in districts_list)
total_aw = total_aw_urban + total_aw_rural
print(f"  Active Anganwadis: {total_aw} (Urban={total_aw_urban}, Rural={total_aw_rural})")

# Total BBBP awareness programs, all-time
total_bbbp = sum(r["actual_programs"] for r in nswld_10 if r["actual_programs"] is not None)
print(f"  Total BBBP programs: {total_bbbp}")

# Total Vahali Dikari beneficiaries, all-time
total_vahali = sum(r["actual"] for r in nswld_10_2 if r["actual"] is not None)
print(f"  Total Vahali Dikari: {total_vahali}")

# AYUSH THR % achievement, all-time
sum_actual_01 = sum(r["actual"] for r in nswld_01 if r["actual"] is not None)
sum_target_01 = sum(r["target"] for r in nswld_01 if r["target"] is not None)
ayush_pct = round(sum_actual_01 / sum_target_01 * 100, 2) if sum_target_01 > 0 else 0
print(f"  AYUSH THR %: {ayush_pct}%")

# Monthly BBBP spread (all-time, Apr-Mar order)
monthly_bbbp = defaultdict(int)
for r in nswld_10:
    if r["actual_programs"] is not None and r["month"]:
        month_upper = r["month"].upper()
        if month_upper in MONTH_ORDER:
            monthly_bbbp[month_upper] += r["actual_programs"]
monthly_bbbp_list = []
for month_name in MONTH_NAMES_FY_ORDER:
    monthly_bbbp_list.append({
        "month": month_name,
        "total_programs": monthly_bbbp.get(month_name.upper(), 0)
    })

# --- Girls Registered vs Trained by FY (DAX Measure Logic) ---
# DAX measure: DIVIDE(SUM(actual), DISTINCTCOUNT(MonthNo where not blank)) / 100000
fy_girls_data = defaultdict(lambda: {"registered_sum": 0, "trained_sum": 0, "months": set()})
for r in nswld_12:
    fy = r["fy"]
    m = r["month"]
    if fy:
        if r["actual_trained"] is not None:
            fy_girls_data[fy]["trained_sum"] += r["actual_trained"]
            if m:
                fy_girls_data[fy]["months"].add(m.upper())
        if r["target_registered"] is not None:
            fy_girls_data[fy]["registered_sum"] += r["target_registered"]

girls_by_fy = []
for fy in sorted(fy_girls_data.keys()):
    month_cnt = len(fy_girls_data[fy]["months"]) or 12
    # Monthly average across active months in that FY
    avg_reg_mo = fy_girls_data[fy]["registered_sum"] / month_cnt
    avg_tr_mo = fy_girls_data[fy]["trained_sum"] / month_cnt
    pct = round(avg_tr_mo / avg_reg_mo * 100, 2) if avg_reg_mo > 0 else 0
    girls_by_fy.append({
        "fy": fy,
        "registered": round(avg_reg_mo, 2),  # per month average
        "trained": round(avg_tr_mo, 2),        # per month average
        "registered_lakh": round((avg_reg_mo / 100000), 2),
        "trained_lakh": round((avg_tr_mo / 100000), 2),
        "pct_trained": pct
    })
print(f"  Girls by FY (Monthly Average DAX Logic): {len(girls_by_fy)} years")
for g in girls_by_fy:
    print(f"    {g['fy']}: Reg/mo={g['registered_lakh']} Lakh, Trained/mo={g['trained_lakh']} Lakh, %={g['pct_trained']}%")

# AYUSH THR % by district (all-time), sorted descending
dist_ayush = defaultdict(lambda: {"actual": 0, "target": 0})
for r in nswld_01:
    if r["district_name"]:
        if r["actual"] is not None:
            dist_ayush[r["district_name"]]["actual"] += r["actual"]
        if r["target"] is not None:
            dist_ayush[r["district_name"]]["target"] += r["target"]
ayush_by_district = []
for dist, vals in dist_ayush.items():
    pct = round(vals["actual"] / vals["target"] * 100, 2) if vals["target"] > 0 else 0
    ayush_by_district.append({"district_name": dist, "pct": pct})
ayush_by_district.sort(key=lambda x: x["pct"], reverse=True)

# Vahali Dikari total by district (all-time) — for choropleth map
dist_vahali = defaultdict(lambda: {"total": 0, "district_code": None})
for r in nswld_10_2:
    if r["district_name"] and r["actual"] is not None:
        dist_vahali[r["district_name"]]["total"] += r["actual"]
        if dist_vahali[r["district_name"]]["district_code"] is None:
            dist_vahali[r["district_name"]]["district_code"] = r["district_code"]
vahali_by_district = []
for dist, vals in sorted(dist_vahali.items()):
    topo_name = DISTRICT_NAME_MAP.get(dist, dist)
    vahali_by_district.append({
        "district_name": dist,
        "district_name_topo": topo_name,
        "district_code": vals["district_code"],
        "total": vals["total"]
    })
vahali_by_district.sort(key=lambda x: x["total"], reverse=True)

overview_aggregates = {
    "avg_girls_trained_per_month_current_fy": avg_girls_trained,
    "active_anganwadis": {"total": total_aw, "rural": total_aw_rural, "urban": total_aw_urban},
    "total_bbbp_programs_all_time": total_bbbp,
    "total_vahali_dikari_beneficiaries_all_time": total_vahali,
    "ayush_thr_pct_all_time": ayush_pct,
    "monthly_bbbp_spread": monthly_bbbp_list,
    "girls_registered_vs_trained_by_fy": girls_by_fy,
    "ayush_thr_pct_by_district": ayush_by_district,
    "vahali_dikari_by_district": vahali_by_district,
    "district_name_map": DISTRICT_NAME_MAP
}
write_json("NSWLD-overview-aggregates.json", overview_aggregates)

# ===========================================================================
# Summary
# ===========================================================================
print("\n" + "=" * 60)
print("ETL COMPLETE — All files written to:", OUT_DIR)
print("=" * 60)
all_files = list(OUT_DIR.glob("*.json"))
for f in sorted(all_files):
    size_kb = f.stat().st_size / 1024
    print(f"  {f.name:42s} {size_kb:8.1f} KB")
print(f"\nTotal: {len(all_files)} files")
