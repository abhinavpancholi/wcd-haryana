import json
from pathlib import Path

data_dir = Path('public/data')
root_dir = Path('.')

print('=== VALIDATION CHECK 1: DISTRICT CODES PER SHEET ===')
district_sheets = [
    ('NSWLD-01.json', 6),
    ('NSWLD-02.json', 23),
    ('NSWLD-05.json', 23),
    ('NSWLD-10.json', 23),
    ('NSWLD-10_2.json', 23),
    ('NSWLD-12.json', 23),
    ('NSWLD-13.json', 23),
    ('NSWLD-17.json', 23),
    ('NSWLD-17_2.json', 23),
    ('NSWLD-compiled.json', 23),
]
state_sheets = ['NSWLD-08.json', 'NSWLD-29.json', 'NSWLD-30.json', 'NSWLD-34.json']

check1_pass = True
for fname, exp_count in district_sheets:
    with open(data_dir / fname, encoding='utf-8') as f:
        data = json.load(f)
    codes = set(r.get('district_code') for r in data if r.get('district_code') is not None)
    status = 'PASS' if len(codes) == exp_count else 'FAIL'
    if status == 'FAIL': check1_pass = False
    print(f'  {fname:22s}: {len(codes)} unique codes (expected {exp_count}) -> {status}')

for fname in state_sheets:
    with open(data_dir / fname, encoding='utf-8') as f:
        data = json.load(f)
    codes = set(r.get('district_code') for r in data if r.get('district_code') is not None)
    status = 'PASS' if len(codes) == 0 else 'FAIL'
    if status == 'FAIL': check1_pass = False
    print(f'  {fname:22s}: {len(codes)} unique codes (expected 0) -> {status}')

print('Check 1 Overall:', 'PASS' if check1_pass else 'FAIL')

print('\n=== VALIDATION CHECK 2: NO GUJARAT DISTRICT NAMES OR CODES IN ANY JSON ===')
gj_names = ['AHMADABAD', 'AHMEDABAD', 'AMRELI', 'ANAND', 'ARVALLI', 'ARAVALLI', 'BANAS KANTHA', 'BANASKANTHA',
            'BHARUCH', 'BHAVNAGAR', 'BOTAD', 'CHHOTAUDEPUR', 'CHHOTA UDAIPUR', 'DAHOD', 'DANG', 'DEVBHUMI DWARKA',
            'GANDHINAGAR', 'GIR SOMNATH', 'JAMNAGAR', 'JUNAGADH', 'KACHCHH', 'KUTCH', 'KHEDA', 'MAHESANA', 'MEHSANA',
            'MORBI', 'MAHISAGAR', 'NARMADA', 'NAVSARI', 'PANCH MAHALS', 'PANCHMAHAL', 'PATAN', 'PORBANDAR',
            'RAJKOT', 'SABAR KANTHA', 'SABARKANTHA', 'SURAT', 'SURENDRANAGAR', 'TAPI', 'VADODARA', 'VALSAD']
gj_codes = {'438', '439', '440', '441', '442', '443', '444', '445', '446', '447', '448', '449', '450',
            '451', '452', '453', '454', '455', '456', '457', '458', '459', '460', '461', '462',
            '641', '668', '669', '672', '673', '674', '675', '676'}

check2_pass = True
for f in sorted(data_dir.glob('*.json')):
    if f.name == 'gujarat.json': continue
    txt = f.read_text(encoding='utf-8')
    for n in gj_names:
        if f'\"district_name\": \"{n}\"' in txt or f'\"name\": \"{n}\"' in txt:
            print(f'  FAIL: Found Gujarat district {n} in {f.name}')
            check2_pass = False
    for c in gj_codes:
        if f'\"district_code\": \"{c}\"' in txt or f'\"district_code\": {c}' in txt or f'\"dist_code\": \"{c}\"' in txt or f'\"dist_code\": {c}' in txt:
            print(f'  FAIL: Found Gujarat code {c} in {f.name}')
            check2_pass = False

print('Check 2 Overall:', 'PASS' if check2_pass else 'FAIL')

print('\n=== VALIDATION CHECK 3: NO GUJARAT REGION NAMES IN JSON OR MAPPING ===')
gj_regions = ['Central Gujarat', 'Coastal Saurashtra', 'North Gujarat', 'South Gujarat', 'Saurashtra']
check3_pass = True
for f in list(data_dir.glob('*.json')) + [root_dir / 'haryana_region_mapping.json']:
    if f.name == 'gujarat.json': continue
    txt = f.read_text(encoding='utf-8')
    for r in gj_regions:
        if r.lower() in txt.lower():
            print(f'  FAIL: Found Gujarat region {r} in {f.name}')
            check3_pass = False

print('Check 3 Overall:', 'PASS' if check3_pass else 'FAIL')

print('\n=== VALIDATION CHECK 4: STATE COLUMN READS HARYANA CONSISTENTLY ===')
check4_pass = True
for f in sorted(data_dir.glob('*.json')):
    if f.name == 'gujarat.json': continue
    txt = f.read_text(encoding='utf-8')
    if '\"state\": \"Gujarat\"' in txt or '\"state\": \"GUJARAT\"' in txt or '\"name\": \"Gujarat\"' in txt:
        print(f'  FAIL: Found Gujarat in state field in {f.name}')
        check4_pass = False

print('Check 4 Overall:', 'PASS' if check4_pass else 'FAIL')

print('\n=== VALIDATION CHECK 5: HARYANA_REGION_MAPPING.JSON 23 ROWS & CODES ===')
with open(root_dir / 'haryana_region_mapping.json', encoding='utf-8') as f:
    hrm = json.load(f)

expected_step1_codes = {58, 68, 70, 76, 67, 71, 66, 73, 64, 75, 59, 701, 63, 396, 61, 74, 65, 62, 72, 69, 60, 619, 604}
hrm_codes = {r['District_Code'] for r in hrm}
hrm_count = len(hrm)
check5_pass = (hrm_count == 23) and (hrm_codes == expected_step1_codes)
print(f'  Row count: {hrm_count} (expected 23)')
print(f'  Codes match Step 1: {hrm_codes == expected_step1_codes}')
print('Check 5 Overall:', 'PASS' if check5_pass else 'FAIL')
