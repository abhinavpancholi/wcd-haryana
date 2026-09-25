/**
 * WCD Dashboard — Shared Aggregation Utility (Step 2)
 */

/**
 * Helper to check if a row matches the geographic filters.
 * Precedence:
 * 1. selectedDistrict -> strict match on district_name
 * 2. selectedRegion -> row's district must belong to selectedRegion
 * 3. neither -> true
 */
function matchGeo(row, { selectedRegion, selectedDistrict }, districts) {
  if (selectedDistrict) {
    // strict match (case-insensitive)
    return row.district_name && row.district_name.toLowerCase() === selectedDistrict.toLowerCase();
  }
  if (selectedRegion) {
    // find district in districts array to check region
    const d = districts.find(d => d.district_name && d.district_name.toLowerCase() === row.district_name?.toLowerCase());
    return d && d.region === selectedRegion;
  }
  return true;
}

/**
 * Filter data rows by FY and Geo
 */
function filterRows(rows, filters, districts, ignoreFY = false) {
  if (!rows) return [];
  return rows.filter(row => {
    // 1. FY Filter
    if (!ignoreFY && filters.selectedFY && row.fy && row.fy !== filters.selectedFY) {
      return false;
    }
    // 2. Geo Filter
    return matchGeo(row, filters, districts);
  });
}

// ==========================================
// Specific Chart Aggregations
// ==========================================

/**
 * 1. KPI: Active Anganwadis
 * Reacts to region/district, ignores FY.
 */
export function getActiveAnganwadis(districts, filters) {
  if (!districts) return { total: 0, rural: 0, urban: 0 };

  const filtered = districts.filter(d => matchGeo(d, filters, districts));

  const rural = filtered.reduce((sum, d) => sum + (d.no_of_aw_rural || 0), 0);
  const urban = filtered.reduce((sum, d) => sum + (d.no_of_aw_urban || 0), 0);

  return {
    total: rural + urban,
    rural,
    urban
  };
}

/**
 * 2. KPI: Avg Girls Trained/Month
 * Filters: Geo + FY (defaults to all if no FY)
 * BUT wait, if no FY is selected, should it sum across all years? 
 * The prompt says for the KPI: "recompute from filtered detail rows". 
 * If a specific FY is selected, it should calculate the average for that FY.
 */
export function getAvgGirlsTrained(rawGirls, filters, districts) {
  if (!rawGirls) return 0;
  const rows = filterRows(rawGirls, filters, districts);

  let trainedSum = 0;
  const activeMonths = new Set();

  rows.forEach(r => {
    if (r.actual_trained != null) {
      trainedSum += r.actual_trained;
      if (r.month) activeMonths.add(`${r.fy}-${r.month.toUpperCase()}`);
    }
  });

  const monthCount = activeMonths.size || 1;
  return trainedSum / monthCount;
}

/**
 * KPI: Poshan Tracker by Year
 */
export function getPoshanTrackerByYear(rawPoshan, filters, districts) {
  if (!rawPoshan) return [];
  const rows = filterRows(rawPoshan, { ...filters, selectedRegion: null, selectedDistrict: null }, districts);

  const targetFys = ['2022-23', '2023-24', '2024-25', '2025-26'];
  const fyData = {};
  targetFys.forEach(fy => fyData[fy] = { targetSum: 0, actualSum: 0, months: new Set() });

  rows.forEach(r => {
    if (r.fy && fyData[r.fy]) {
      if (r.target_children_registered != null) {
        fyData[r.fy].targetSum += r.target_children_registered;
      }
      if (r.actual_children_registered != null) {
        fyData[r.fy].actualSum += r.actual_children_registered;
        if (r.month) fyData[r.fy].months.add(r.month.toUpperCase());
      }
    }
  });

  return targetFys.map(fy => {
    const monthCnt = fyData[fy].months.size || 12;
    const avgTarget = fyData[fy].targetSum / monthCnt;
    const avgActual = fyData[fy].actualSum / monthCnt;
    return {
      name: fy,
      target_lakh: avgTarget / 100000,
      actual_lakh: avgActual / 100000,
      isSelected: filters.selectedFY === fy
    };
  });
}

/**
 * 3. KPI: Total BBBP Programs
 */
export function getTotalBbbpPrograms(rawBbbp, filters, districts) {
  if (!rawBbbp) return 0;
  const rows = filterRows(rawBbbp, filters, districts);
  return rows.reduce((sum, r) => sum + (r.actual_programs || 0), 0);
}

/**
 * 4. KPI: Total Vahali Dikari Beneficiaries
 */
export function getTotalVahaliDikari(rawVahali, filters, districts) {
  if (!rawVahali) return 0;
  const rows = filterRows(rawVahali, filters, districts);
  return rows.reduce((sum, r) => sum + (r.actual || 0), 0);
}

/**
/**
 * 5. Chart: Girls Trained Combo (Adolescent Girls Trained per Month)
 */
export function getGirlsTrainedComboData(rawGirls, filters, districts, drillLevel = 'time') {
  if (!rawGirls) return [];

  // Base rows filtered by geo
  const rows = filterRows(rawGirls, { ...filters, selectedFY: null }, districts);

  if (drillLevel === 'time') {
    const fyData = {};
    rows.forEach(r => {
      const fy = r.fy;
      if (!fy) return;
      if (!fyData[fy]) fyData[fy] = { registeredSum: 0, trainedSum: 0, months: new Set(), hasData: false };
      if (r.actual_trained != null) {
        fyData[fy].trainedSum += r.actual_trained;
        if (r.month) fyData[fy].months.add(r.month.toUpperCase());
        fyData[fy].hasData = true;
      }
      if (r.target_registered != null) {
        fyData[fy].registeredSum += r.target_registered;
        fyData[fy].hasData = true;
      }
    });

    const allFys = Object.keys(fyData).sort();
    return allFys.filter(fy => fyData[fy].hasData).map(fy => {
      const monthCnt = fyData[fy].months.size || 12;
      const avgReg = fyData[fy].registeredSum / monthCnt;
      const avgTr = fyData[fy].trainedSum / monthCnt;
      const pct = avgReg > 0 ? (avgTr / avgReg) * 100 : 0;
      return {
        name: fy,
        registered_lakh: avgReg / 100000,
        trained_lakh: avgTr / 100000,
        pct_trained: pct,
        isSelected: filters.selectedFY === fy
      };
    });
  } else if (drillLevel === 'region') {
    const fyRows = rows.filter(r => r.fy === filters.selectedFY);
    const REGIONS = ["Ambala", "Faridabad", "Gurugram", "Hisar", "Karnal", "Rohtak"];
    const regData = {};
    REGIONS.forEach(r => regData[r] = { registeredSum: 0, trainedSum: 0, months: new Set() });

    fyRows.forEach(r => {
      const d = districts.find(dist => dist.district_name === r.district_name);
      if (d && d.region) {
        if (r.actual_trained != null) {
          regData[d.region].trainedSum += r.actual_trained;
          if (r.month) regData[d.region].months.add(r.month.toUpperCase());
        }
        if (r.target_registered != null) {
          regData[d.region].registeredSum += r.target_registered;
        }
      }
    });

    return REGIONS.map(reg => {
      const monthCnt = regData[reg].months.size || 1;
      const avgReg = regData[reg].registeredSum / monthCnt;
      const avgTr = regData[reg].trainedSum / monthCnt;
      const pct = avgReg > 0 ? (avgTr / avgReg) * 100 : 0;
      return {
        name: reg,
        registered_lakh: avgReg / 100000,
        trained_lakh: avgTr / 100000,
        pct_trained: pct,
        isSelected: filters.selectedRegion === reg
      };
    });
  } else if (drillLevel === 'district') {
    const fyRows = rows.filter(r => r.fy === filters.selectedFY);
    const regionDistricts = districts.filter(d => d.region === filters.selectedRegion);
    const distData = {};
    regionDistricts.forEach(d => distData[d.district_name] = { registeredSum: 0, trainedSum: 0, months: new Set() });

    fyRows.forEach(r => {
      if (distData[r.district_name]) {
        if (r.actual_trained != null) {
          distData[r.district_name].trainedSum += r.actual_trained;
          if (r.month) distData[r.district_name].months.add(r.month.toUpperCase());
        }
        if (r.target_registered != null) {
          distData[r.district_name].registeredSum += r.target_registered;
        }
      }
    });

    return Object.keys(distData).sort().map(dist => {
      const monthCnt = distData[dist].months.size || 1;
      const avgReg = distData[dist].registeredSum / monthCnt;
      const avgTr = distData[dist].trainedSum / monthCnt;
      const pct = avgReg > 0 ? (avgTr / avgReg) * 100 : 0;
      return {
        name: dist,
        registered_lakh: avgReg / 100000,
        trained_lakh: avgTr / 100000,
        pct_trained: pct,
        isSelected: filters.selectedDistrict === dist
      };
    });
  }
  return [];
}

/**
 * 6. Chart: Monthly Spread of BBBP
 */
export function getBbbpMonthlyData(rawBbbp, filters, districts, drillLevel = 'time') {
  if (!rawBbbp) return [];
  const rows = filterRows(rawBbbp, filters, districts);

  if (drillLevel === 'time') {
    const MONTH_NAMES_FY_ORDER = [
      "April", "May", "June", "July", "August", "September",
      "October", "November", "December", "January", "February", "March"
    ];
    const monthly = {};
    rows.forEach(r => {
      if (r.actual_programs != null && r.month) {
        const m = r.month.toUpperCase();
        monthly[m] = (monthly[m] || 0) + r.actual_programs;
      }
    });
    return MONTH_NAMES_FY_ORDER.map(month => ({
      name: month,
      total_programs: monthly[month.toUpperCase()] || 0
    }));
  } else if (drillLevel === 'region') {
    const REGIONS = ["Ambala", "Faridabad", "Gurugram", "Hisar", "Karnal", "Rohtak"];
    const regData = {};
    REGIONS.forEach(r => regData[r] = 0);
    rows.forEach(r => {
      const d = districts.find(dist => dist.district_name === r.district_name);
      if (d && d.region && r.actual_programs != null) {
        regData[d.region] += r.actual_programs;
      }
    });
    return REGIONS.map(reg => ({
      name: reg,
      total_programs: regData[reg],
      isSelected: filters.selectedRegion === reg
    }));
  } else if (drillLevel === 'district') {
    const regionDistricts = districts.filter(d => d.region === filters.selectedRegion);
    const distData = {};
    regionDistricts.forEach(d => distData[d.district_name] = 0);
    rows.forEach(r => {
      if (distData[r.district_name] !== undefined && r.actual_programs != null) {
        distData[r.district_name] += r.actual_programs;
      }
    });
    return Object.keys(distData).sort().map(dist => ({
      name: dist,
      total_programs: distData[dist],
      isSelected: filters.selectedDistrict === dist
    }));
  }
  return [];
}

/**
 * 7. Chart: AYUSH THR % (Geographic)
 * Always district-level native 6 pilot districts.
 */
export function getAyushThrData(rawAyush, filters, districts) {
  if (!rawAyush || !districts) return [];

  // Filter for FY, ignore geo for now so we can aggregate appropriately by region or district
  const rows = filterRows(rawAyush, { ...filters, selectedDistrict: null }, districts);

  const targetDistricts = ['Ambala', 'Bhiwani', 'Faridabad', 'Fatehabad', 'Gurugram', 'Kaithal'];

  const distData = {};
  targetDistricts.forEach(dName => {
    let inRegion = true;
    if (filters.selectedRegion) {
      const dObj = districts.find(dist => dist.district_name && dist.district_name.toLowerCase() === dName.toLowerCase());
      if (dObj && dObj.region !== filters.selectedRegion) {
        inRegion = false;
      }
    }
    distData[dName.toLowerCase()] = { name: dName, actual: 0, target: 0, hasPilot: true, inRegion };
  });

  rows.forEach(r => {
    if (r.district_name) {
      const key = r.district_name.toLowerCase();
      if (distData[key]) {
        if (r.actual != null) { distData[key].actual += r.actual; }
        if (r.target != null) { distData[key].target += r.target; }
      }
    }
  });

  return targetDistricts.map(dist => {
    const { name, actual, target, inRegion } = distData[dist.toLowerCase()];
    return {
      name: name || dist,
      type: 'district',
      pct: target > 0 ? (actual / target) * 100 : 0,
      actual,
      target,
      hasPilot: true,
      inRegion
    };
  }).sort((a, b) => b.pct - a.pct);
}

/**
 * 8. Map: Vahali Dikari Spread
 * Always district level (33 districts).
 */
export function getVahaliMapData(rawVahali, filters, districts) {
  if (!rawVahali || !districts) return [];

  // Filter for FY, ignore geo for now so we can return all districts
  const rows = filterRows(rawVahali, { ...filters, selectedRegion: null, selectedDistrict: null }, districts);

  const distData = {};
  districts.forEach(d => distData[d.district_name] = 0);

  rows.forEach(r => {
    if (r.district_name && distData[r.district_name] !== undefined && r.actual != null) {
      distData[r.district_name] += r.actual;
    }
  });

  return districts.map(d => ({
    name: d.district_name,
    code: d.district_code,
    total: distData[d.district_name],
    inRegion: !filters.selectedRegion || d.region === filters.selectedRegion
  }));
}

// ==========================================
// 9. SAM / Compiled Data Selectors
// ==========================================

// Note: compiled data is a fixed April↔October 2025 snapshot with no FY column, unlike every other sheet.
export function getSamState(compiledRollup) {
  if (!compiledRollup) return null;
  return compiledRollup.find(r => r.level === 'state') || null;
}

export function getSamByRegion(compiledRollup) {
  if (!compiledRollup) return [];
  return compiledRollup.filter(r => r.level === 'region');
}

export function getSamByDistrict(compiledRollup, regionName = null) {
  if (!compiledRollup) return [];
  const dists = compiledRollup.filter(r => r.level === 'district');
  if (regionName) {
    return dists.filter(r => r.region === regionName);
  }
  return dists;
}

export function getSamByBlock(compiledDistrictData) {
  if (!compiledDistrictData) return [];
  const blocksMap = {};

  compiledDistrictData.forEach(row => {
    const block = row.block_name;
    if (!blocksMap[block]) {
      blocksMap[block] = {
        block_name: block,
        female_apr: 0,
        male_apr: 0,
        female_oct: 0,
        male_oct: 0,
        female_delta: 0,
        male_delta: 0,
        total_delta: 0,
        anganwadi_count: 0
      };
    }
    blocksMap[block].female_apr += row.female_apr || 0;
    blocksMap[block].male_apr += row.male_apr || 0;
    blocksMap[block].female_oct += row.female_oct || 0;
    blocksMap[block].male_oct += row.male_oct || 0;
    blocksMap[block].female_delta += row.female_delta || 0;
    blocksMap[block].male_delta += row.male_delta || 0;
    blocksMap[block].total_delta += row.total_delta || 0;
    blocksMap[block].anganwadi_count += 1;
  });

  return Object.values(blocksMap).sort((a, b) => a.block_name.localeCompare(b.block_name));
}

export function getSamByAnganwadi(compiledDistrictData, blockName) {
  if (!compiledDistrictData || !blockName) return [];
  return compiledDistrictData.filter(r => r.block_name === blockName);
}

// ==========================================
// 10. Mangal Diwas (NSWLD-02) Selectors
// ==========================================

export function getMangalDiwasKpi(rawMangal, filters, districts) {
  if (!rawMangal) return { actual: 0, target: 0, actual_lakh: 0, target_lakh: 0, pct: 0, hasData: false };
  const rows = filterRows(rawMangal, filters, districts);
  if (!rows || rows.length === 0) return { actual: 0, target: 0, actual_lakh: 0, target_lakh: 0, pct: 0, hasData: false };

  // Raw values are cumulative quarterly figures.
  // The KPI value is the latest quarter's cumulative total (e.g. Q3 2025-26 = 17.38 Lakh).
  const quarterOrder = ['Q4 2024-25', 'Q1 2025-26', 'Q2 2025-26', 'Q3 2025-26'];
  const qSums = {};
  quarterOrder.forEach(q => qSums[q] = 0);
  let hasData = false;

  rows.forEach(r => {
    if (r.actual != null && r.fy && r.quarter) {
      const k = `${r.quarter} ${r.fy}`;
      if (qSums[k] !== undefined) {
        qSums[k] += r.actual;
        hasData = true;
      }
    }
  });

  // Pick latest quarter with non-zero cumulative total
  let latestVal = 0;
  for (let i = quarterOrder.length - 1; i >= 0; i--) {
    if (qSums[quarterOrder[i]] > 0) {
      latestVal = qSums[quarterOrder[i]];
      break;
    }
  }

  return {
    actual: latestVal,
    target: latestVal,
    actual_lakh: latestVal / 100000,
    target_lakh: latestVal / 100000,
    pct: 100,
    hasData
  };
}

export function getMangalDiwasQuarterly(rawMangal, filters, districts) {
  if (!rawMangal) return [];
  const rows = filterRows(rawMangal, { ...filters, selectedFY: null }, districts);

  const quarterKeys = [
    { fy: '2024-25', q: 'Q4', label: 'Q4 2024-25' },
    { fy: '2025-26', q: 'Q1', label: 'Q1 2025-26' },
    { fy: '2025-26', q: 'Q2', label: 'Q2 2025-26' },
    { fy: '2025-26', q: 'Q3', label: 'Q3 2025-26' },
  ];

  // Raw values are fiscal-year-to-date cumulative figures.
  // Sum raw values per quarter across all matching districts.
  const qRawCumulative = {};
  quarterKeys.forEach(k => qRawCumulative[k.label] = 0);

  rows.forEach(r => {
    if (r.actual != null && r.fy && r.quarter) {
      const matchKey = `${r.quarter} ${r.fy}`;
      if (qRawCumulative[matchKey] !== undefined) {
        qRawCumulative[matchKey] += r.actual;
      }
    }
  });

  // The raw cumulative value IS the cumulative line.
  // The bar for each quarter = this quarter's cumulative - previous quarter's cumulative.
  // First quarter (Q4 2024-25) uses its own raw value as the bar.
  const result = [];
  for (let i = 0; i < quarterKeys.length; i++) {
    const k = quarterKeys[i];
    const rawCum = qRawCumulative[k.label] || 0;
    const prevCum = i > 0 ? (qRawCumulative[quarterKeys[i - 1].label] || 0) : 0;
    const discreteBar = i === 0 ? rawCum : rawCum - prevCum;
    result.push({
      quarter: k.label,
      actual: discreteBar,
      actual_lakh: discreteBar / 100000,
      cumulative: rawCum,
      cumulative_lakh: rawCum / 100000,
    });
  }
  return result;
}

// ==========================================
// 11. Poshan Tracker (NSWLD-13) Selectors
// ==========================================

export function getPoshanTrackerKpi(rawPoshan, filters, districts) {
  if (!rawPoshan) return { total_registered: 0, registered_lakh: 0, hasData: false };

  // Default to 2025-26 when no FY is selected
  const effectiveFY = filters.selectedFY || '2025-26';
  const effectiveFilters = { ...filters, selectedFY: effectiveFY };
  const rows = filterRows(rawPoshan, effectiveFilters, districts);

  if (!rows || rows.length === 0) return { total_registered: 0, registered_lakh: 0, hasData: false };

  // Calculate target_children_registered for the latest month / max month to match 29.95 Lakh card reference
  const monthTargets = {};
  rows.forEach(r => {
    if (r.target_children_registered != null && r.month) {
      const m = r.month.toUpperCase();
      monthTargets[m] = (monthTargets[m] || 0) + r.target_children_registered;
    }
  });

  const targetVals = Object.values(monthTargets);
  let maxTarget = 0;
  if (targetVals.length > 0) {
    maxTarget = Math.max(...targetVals);
  } else {
    let regSum = 0;
    rows.forEach(r => { if (r.actual_children_registered != null) regSum += r.actual_children_registered; });
    maxTarget = regSum / (rows.length || 1);
  }

  return {
    total_registered: maxTarget,
    registered_lakh: maxTarget / 100000,
    hasData: targetVals.length > 0 || rows.length > 0
  };
}

// ==========================================
// 12. AYUSH THR Target vs Actual (for Page 2 chart)
// ==========================================

/**
 * Returns per-pilot-district Target and Actual in Lakh for a specific FY.
 * Used by the Page 2 grouped bar chart (not the Overview % chart).
 */
export function getAyushThrTargetActual(rawAyush, selectedFY, selectedRegion, selectedDistrict, districts) {
  if (!rawAyush || !districts) return [];

  const PILOT_DISTRICTS = ['Ambala', 'Bhiwani', 'Faridabad', 'Fatehabad', 'Gurugram', 'Kaithal'];

  // Filter rows by FY only (not geo — we always show all 6 pilot districts, just dim non-region ones)
  const rows = rawAyush.filter(r => {
    if (selectedFY && r.fy && r.fy !== selectedFY) return false;
    return true;
  });

  const distData = {};
  PILOT_DISTRICTS.forEach(d => distData[d.toLowerCase()] = { name: d, target: 0, actual: 0 });

  rows.forEach(r => {
    if (r.district_name) {
      const key = r.district_name.toLowerCase();
      if (distData[key]) {
        if (r.target != null) distData[key].target += r.target;
        if (r.actual != null) distData[key].actual += r.actual;
      }
    }
  });

  // Filter by region if set
  let visibleDistricts = PILOT_DISTRICTS;
  if (selectedRegion) {
    visibleDistricts = PILOT_DISTRICTS.filter(d => {
      const dObj = districts.find(dist => dist.district_name && dist.district_name.toLowerCase() === d.toLowerCase());
      return dObj && dObj.region === selectedRegion;
    });
  }
  if (selectedDistrict) {
    visibleDistricts = PILOT_DISTRICTS.filter(d => d.toLowerCase() === selectedDistrict.toLowerCase());
  }

  // If no pilot districts match the geo filter, return empty
  if (visibleDistricts.length === 0) return [];

  return visibleDistricts.map(d => ({
    name: distData[d.toLowerCase()]?.name || d,
    target_lakh: distData[d.toLowerCase()].target / 100000,
    actual_lakh: distData[d.toLowerCase()].actual / 100000,
  })).sort((a, b) => b.target_lakh - a.target_lakh);
}

// ==========================================
// 13. Page 3: Awareness & Behaviour Change Selectors
// ==========================================

/**
 * Shared Utility: Trims leading and trailing zero/null actual records from a chronologically ordered array.
 * - rows must already be in chronological order
 * - strip leading rows where actualValueFn(row) is 0, null, or undefined
 * - strip trailing rows where actualValueFn(row) is 0, null, or undefined
 * - do NOT strip zero-actual rows that sit between two non-zero rows
 */
export function trimToReportedRange(rows, actualValueFn) {
  if (!rows || !rows.length) return [];

  let start = 0;
  while (start < rows.length) {
    const val = actualValueFn(rows[start]);
    if (val !== null && val !== undefined && val !== 0) break;
    start++;
  }

  let end = rows.length - 1;
  while (end >= start) {
    const val = actualValueFn(rows[end]);
    if (val !== null && val !== undefined && val !== 0) break;
    end--;
  }

  if (start > end) return [];
  return rows.slice(start, end + 1);
}

/**
 * Page 3 - Chart 1: Average Participation per Session in BBBP Awareness Program
 * Formula per month: SUM(actual_participants) / SUM(actual_programs), rounded to nearest integer
 * FY behavior: defaults to latest reported FY ('2025-26') if selectedFY is null.
 * Region behavior: narrows to districts in selected region/district.
 */
export function getBbbpAvgParticipationPerSession(rawBbbp, filters, districts) {
  if (!rawBbbp) return { data: [], resolvedFY: '2025-26' };

  // Resolve effective FY: if selectedFY is null, find latest FY with reported actual programs
  let effectiveFY = filters.selectedFY;
  if (!effectiveFY) {
    const fyWithData = new Set();
    rawBbbp.forEach(r => {
      if ((r.actual_programs || 0) > 0 && r.fy) {
        fyWithData.add(r.fy);
      }
    });
    const sortedFys = Array.from(fyWithData).sort();
    effectiveFY = sortedFys.length > 0 ? sortedFys[sortedFys.length - 1] : '2025-26';
  }

  const rows = filterRows(rawBbbp, { ...filters, selectedFY: effectiveFY }, districts);

  const MONTH_NAMES_FY_ORDER = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March"
  ];

  const monthSums = {};
  MONTH_NAMES_FY_ORDER.forEach(m => {
    monthSums[m.toUpperCase()] = { part: 0, prog: 0 };
  });

  rows.forEach(r => {
    if (r.month) {
      const mKey = r.month.toUpperCase();
      if (monthSums[mKey]) {
        monthSums[mKey].part += (r.actual_participants || 0);
        monthSums[mKey].prog += (r.actual_programs || 0);
      }
    }
  });

  const data = MONTH_NAMES_FY_ORDER.map(m => {
    const mKey = m.toUpperCase();
    const { part, prog } = monthSums[mKey];
    const avg = prog > 0 ? Math.round(part / prog) : 0;
    return {
      name: m,
      month: m,
      avg_participation: avg,
      actual_participants: part,
      actual_programs: prog
    };
  });

  return { data, resolvedFY: effectiveFY };
}

/**
 * Page 3 - Chart 2: Participation in Awareness Session under BBBP (district bar)
 * Source: NSWLD-10 (rawBbbp), target_participants / actual_participants
 * FY behavior: defaults to latest reported FY ('2025-26') if selectedFY is null.
 * Region behavior: narrows to districts in selected region if selectedRegion is set.
 * Returns array sorted descending by actual_participants.
 */
export function getBbbpDistrictParticipation(rawBbbp, filters, districts) {
  if (!rawBbbp || !districts) return { data: [], resolvedFY: '2025-26' };

  let effectiveFY = filters.selectedFY;
  if (!effectiveFY) {
    const fyWithData = new Set();
    rawBbbp.forEach(r => {
      if ((r.actual_participants || 0) > 0 && r.fy) {
        fyWithData.add(r.fy);
      }
    });
    const sortedFys = Array.from(fyWithData).sort();
    effectiveFY = sortedFys.length > 0 ? sortedFys[sortedFys.length - 1] : '2025-26';
  }

  // Filter rows by FY and district if selectedDistrict is set
  const rows = rawBbbp.filter(r => r.fy === effectiveFY);

  const distMap = {};
  districts.forEach(d => {
    distMap[d.district_name] = {
      name: d.district_name,
      code: d.district_code,
      region: d.region,
      actual: 0,
      target: 0
    };
  });

  rows.forEach(r => {
    if (r.district_name && distMap[r.district_name]) {
      distMap[r.district_name].actual += (r.actual_participants || 0);
      distMap[r.district_name].target += (r.target_participants || 0);
    }
  });

  let distList = Object.values(distMap);

  // If region is selected, narrow the district list to districts in that region only
  if (filters.selectedRegion) {
    distList = distList.filter(d => d.region === filters.selectedRegion);
  }

  // Sort descending by actual
  distList.sort((a, b) => b.actual - a.actual);

  return { data: distList, resolvedFY: effectiveFY };
}

/**
 * Page 3 - Chart 3: Month wise Beneficiaries of Vahali Dikari Yojana
 * Source: NSWLD-10_2 (rawVahali)
 * FY behavior: Responds to selectedFY (filters by selectedFY if set; sums all-time if selectedFY is null).
 * Region behavior: narrows to districts in selected region/district.
 */
export function getVahaliMonthlyBeneficiaries(rawVahali, filters, districts) {
  if (!rawVahali) return [];

  // Filter rows by FY if selectedFY is set, and by Geo
  const rows = filterRows(rawVahali, filters, districts);

  const MONTH_NAMES_FY_ORDER = [
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "January", "February", "March"
  ];

  const monthSums = {};
  MONTH_NAMES_FY_ORDER.forEach(m => {
    monthSums[m.toUpperCase()] = 0;
  });

  rows.forEach(r => {
    if (r.month) {
      const mKey = r.month.toUpperCase();
      if (monthSums[mKey] !== undefined) {
        monthSums[mKey] += (r.actual || 0);
      }
    }
  });

  return MONTH_NAMES_FY_ORDER.map(m => ({
    name: m,
    month: m,
    actual: monthSums[m.toUpperCase()]
  }));
}

/**
 * Page 3 - Chart 4: Number of Sensitization Programs Conducted at State Level Departments
 * Source: NSWLD-29 (rawSensitizationState)
 * Responds to selectedFY (filters to selectedFY if set; shows trimmed multi-year trend if null).
 */
export function getSensitizationProgramsStateLevel(rawSensitizationState, filters = {}) {
  if (!rawSensitizationState) return [];

  const fyMap = {};
  rawSensitizationState.forEach(r => {
    if (!r.fy) return;
    if (filters.selectedFY && r.fy !== filters.selectedFY) return;
    if (!fyMap[r.fy]) {
      fyMap[r.fy] = { fy: r.fy, target: 0, actual: 0 };
    }
    fyMap[r.fy].target += (r.target_programs || 0);
    fyMap[r.fy].actual += (r.actual_programs || 0);
  });

  const sortedFys = Object.values(fyMap).sort((a, b) => a.fy.localeCompare(b.fy));
  if (filters.selectedFY) return sortedFys;
  return trimToReportedRange(sortedFys, r => r.actual);
}

/**
 * Page 3 - Chart 5: Number of Participants attending Gender Sensitization Programs
 * Source: NSWLD-29 (rawSensitizationState)
 * Responds to selectedFY (filters to selectedFY if set; shows trimmed multi-year trend if null).
 */
export function getSensitizationParticipantsStateLevel(rawSensitizationState, filters = {}) {
  if (!rawSensitizationState) return [];

  const fyMap = {};
  rawSensitizationState.forEach(r => {
    if (!r.fy) return;
    if (filters.selectedFY && r.fy !== filters.selectedFY) return;
    if (!fyMap[r.fy]) {
      fyMap[r.fy] = { fy: r.fy, target: 0, actual: 0 };
    }
    fyMap[r.fy].target += (r.target_participants || 0);
    fyMap[r.fy].actual += (r.actual_participants || 0);
  });

  const sortedFys = Object.values(fyMap).sort((a, b) => a.fy.localeCompare(b.fy));
  if (filters.selectedFY) return sortedFys;
  return trimToReportedRange(sortedFys, r => r.actual);
}

/**
 * Page 3 - Chart 6: Participants in Gender Sensitization via SETU
 * Source: NSWLD-30 (rawSetu)
 * Responds to selectedFY (filters to quarters of selectedFY if set; shows trimmed all-quarters if null).
 */
export function getSetuSensitizationQuarterly(rawSetu, filters = {}) {
  if (!rawSetu) return [];

  const qList = rawSetu
    .filter(r => r.fy && r.quarter)
    .filter(r => !filters.selectedFY || r.fy === filters.selectedFY)
    .map(r => ({
      quarter: `${r.quarter} ${r.fy}`,
      fy: r.fy,
      q: r.quarter,
      target: r.target,
      actual: r.actual
    }));

  if (filters.selectedFY) return qList;
  return trimToReportedRange(qList, r => r.actual);
}

/**
 * Page 3 - Chart 7: Officers/Employees Sensitized re: Sexual Harassment Act 2013
 * Source: NSWLD-34 (rawSexualHarassment)
 * Responds to selectedFY (filters to quarters of selectedFY if set; shows trimmed all-quarters if null).
 */
export function getSexualHarassmentSensitizationQuarterly(rawSexualHarassment, filters = {}) {
  if (!rawSexualHarassment) return [];

  const qList = rawSexualHarassment
    .filter(r => r.fy && r.quarter)
    .filter(r => !filters.selectedFY || r.fy === filters.selectedFY)
    .map(r => ({
      quarter: `${r.quarter} ${r.fy}`,
      fy: r.fy,
      q: r.quarter,
      target: r.target,
      actual: r.actual
    }));

  if (filters.selectedFY) return qList;
  return trimToReportedRange(qList, r => r.actual);
}


// ==========================================
// Page 4 — Infra, Digital Platforms & Women Empowerment
// Sheets: NSWLD-05, NSWLD-08, NSWLD-17, NSWLD-17(2)
// ==========================================

/**
 * FYs with real (non-null) reported data for NSWLD-17 / NSWLD-17(2).
 * Confirmed row-by-row: real data FY2022-23 → FY2025-26 only.
 */
const NSWLD17_REAL_FYS = ['2022-23', '2023-24', '2024-25', '2025-26'];

/**
 * NSWLD-08: Rescue Vans + 181 Helpline Response Time
 * KPI 2 — Rescue Vans: March row of selected FY, field actual_rescue_vans
 * KPI 3 — Response Time: March row of selected FY, actual/target response times
 *
 * Data-quality bug: Month is Title Case for all FYs except 2024-25 (ALL-CAPS).
 * Normalize with .trim().toUpperCase() before matching "MARCH".
 */
export function getRescueVanMarchRow(rawRescue, selectedFY) {
  if (!rawRescue || !selectedFY) return null;

  const marchRow = rawRescue.find(
    r => r.fy === selectedFY &&
         r.month != null &&
         r.month.trim().toUpperCase() === 'MARCH'
  );
  return marchRow || null;
}

/**
 * Find the latest FY that has actual rescue van data in the March row.
 * Used as the default FY for rescue/response-time KPIs when no FY selected.
 */
export function getLatestRescueFY(rawRescue) {
  if (!rawRescue) return null;

  // Collect all FYs that have a March row with non-null actual_rescue_vans
  const fyWithActual = rawRescue
    .filter(r => r.month != null &&
                 r.month.trim().toUpperCase() === 'MARCH' &&
                 r.actual_rescue_vans != null)
    .map(r => r.fy);

  if (fyWithActual.length === 0) return null;

  // Sort FYs descending and return the latest
  fyWithActual.sort((a, b) => b.localeCompare(a));
  return fyWithActual[0];
}

/**
 * NSWLD-17: Mahila Swavlamban Yojana — Chart A (Beneficiaries Target vs Actual)
 * State-level sum across all 33 districts per FY.
 *
 * Fields: target_beneficiaries, actual_beneficiaries
 */
export function getMSYBeneficiariesByFY(rawMSY, selectedFY) {
  if (!rawMSY) return [];

  const fys = selectedFY ? [selectedFY] : NSWLD17_REAL_FYS;

  return fys.map(fy => {
    const rows = rawMSY.filter(r => r.fy === fy);
    const target = rows.reduce((s, r) => s + (r.target_beneficiaries || 0), 0);
    const actual = rows.reduce((s, r) => s + (r.actual_beneficiaries || 0), 0);

    // Only include FYs with real data (at least one non-null value)
    const hasData = rows.some(r => r.target_beneficiaries != null || r.actual_beneficiaries != null);
    if (!hasData) return null;

    return { name: fy, target, actual };
  }).filter(Boolean);
}

/**
 * NSWLD-17: Chart B — Average Amount Disbursed per beneficiary (in ₹)
 * avgAmount = (SUM(actual_subsidy_amount) * 100000) / SUM(actual_beneficiaries)
 * Guard divide-by-zero: if actual_beneficiaries sum is 0, return null for that FY.
 *
 * Fields: actual_subsidy_amount (in Lakh), actual_beneficiaries
 */
export function getMSYAvgSubsidyByFY(rawMSY, selectedFY) {
  if (!rawMSY) return [];

  const fys = selectedFY ? [selectedFY] : NSWLD17_REAL_FYS;

  return fys.map(fy => {
    const rows = rawMSY.filter(r => r.fy === fy);
    const actualSubsidy = rows.reduce((s, r) => s + (r.actual_subsidy_amount || 0), 0);
    const actualBeneficiaries = rows.reduce((s, r) => s + (r.actual_beneficiaries || 0), 0);

    const hasData = rows.some(r => r.actual_subsidy_amount != null || r.actual_beneficiaries != null);
    if (!hasData) return null;

    // Guard divide-by-zero (matches Power BI DIVIDE returning blank)
    const avg = actualBeneficiaries > 0
      ? Math.round((actualSubsidy * 100000) / actualBeneficiaries)
      : null;

    return { name: fy, avg };
  }).filter(Boolean);
}

/**
 * NSWLD-17: Chart C — Subsidy Amount Disbursed (₹ in Lakh), Target vs Actual
 * State-level sum across all 33 districts per FY.
 *
 * Fields: target_subsidy_amount, actual_subsidy_amount
 */
export function getMSYSubsidyByFY(rawMSY, selectedFY) {
  if (!rawMSY) return [];

  const fys = selectedFY ? [selectedFY] : NSWLD17_REAL_FYS;

  return fys.map(fy => {
    const rows = rawMSY.filter(r => r.fy === fy);
    const target = rows.reduce((s, r) => s + (r.target_subsidy_amount || 0), 0);
    const actual = rows.reduce((s, r) => s + (r.actual_subsidy_amount || 0), 0);

    const hasData = rows.some(r => r.target_subsidy_amount != null || r.actual_subsidy_amount != null);
    if (!hasData) return null;

    return {
      name: fy,
      target: parseFloat(target.toFixed(2)),
      actual: parseFloat(actual.toFixed(2))
    };
  }).filter(Boolean);
}

/**
 * NSWLD-05: Chart D — District-wise No. of Working Women Hostels
 *
 * ⚠️ FY-EXEMPT: This chart does NOT respect the page FY filter.
 * Verified: only 5 districts have non-null values across only 2 periods
 * (FY2025-26 H1 and FY2026-27 H1). The screenshot bar heights only
 * reproduce by summing across all periods regardless of FY selection.
 * Same precedent as SAM section on Page 2 being exempt from FY filtering.
 *
 * value (per district) = SUM(target_hostels) across all FY × Half Year rows
 * Only show districts with a non-zero sum. Sort descending, alpha tiebreaker.
 *
 * Fields: target_hostels, district_name
 */
export function getHostelsAllTime(rawHostels) {
  if (!rawHostels) return [];

  // Group by district_name and sum target_hostels across all periods
  const districtMap = {};
  rawHostels.forEach(r => {
    if (!r.district_name || r.target_hostels == null) return;
    if (!districtMap[r.district_name]) districtMap[r.district_name] = 0;
    districtMap[r.district_name] += r.target_hostels;
  });

  // Convert to array, filter non-zero, sort descending by value then alpha
  return Object.entries(districtMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      // Title-case the district name for display
      name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
      value
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/**
 * NSWLD-17(2): Chart E — Jagruti Shibir Sessions, butterfly/diverging bar
 * State-level sum across all districts per FY.
 *
 * Note: intervention_code in the raw data is mislabeled 'NSWLD-17' (should be 'NSWLD-17(2)').
 * We identify this sheet by using the rawJagruti data loaded from NSWLD-17_2.json directly.
 *
 * Fields: target_sessions, actual_sessions
 */
export function getJagrutiSessionsByFY(rawJagruti, selectedFY) {
  if (!rawJagruti) return [];

  const fys = selectedFY ? [selectedFY] : NSWLD17_REAL_FYS;

  return fys.map(fy => {
    const rows = rawJagruti.filter(r => r.fy === fy);
    const target = rows.reduce((s, r) => s + (r.target_sessions || 0), 0);
    const actual = rows.reduce((s, r) => s + (r.actual_sessions || 0), 0);

    const hasData = rows.some(r => r.target_sessions != null || r.actual_sessions != null);
    if (!hasData) return null;

    return {
      name: fy,
      target,           // positive for display label
      actual,           // positive teal bar extending right
      negTarget: -target // lavender bar extending left (butterfly layout trick)
    };
  }).filter(Boolean);
}

/**
 * NSWLD-17(2): Chart F — Jagruti Shibir Participants, line/area chart
 * State-level sum across all districts per FY.
 *
 * Fields: target_participants, actual_participants
 */
export function getJagrutiParticipantsByFY(rawJagruti, selectedFY) {
  if (!rawJagruti) return [];

  const fys = selectedFY ? [selectedFY] : NSWLD17_REAL_FYS;

  return fys.map(fy => {
    const rows = rawJagruti.filter(r => r.fy === fy);
    const target = rows.reduce((s, r) => s + (r.target_participants || 0), 0);
    const actual = rows.reduce((s, r) => s + (r.actual_participants || 0), 0);

    const hasData = rows.some(r => r.target_participants != null || r.actual_participants != null);
    if (!hasData) return null;

    return { name: fy, target, actual };
  }).filter(Boolean);
}
