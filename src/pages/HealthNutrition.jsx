import React from 'react'
import useWcdStore from '../context/WcdStore'
import DashboardLayout from '../components/layout/DashboardLayout'
import AyushThrChart from '../components/charts/AyushThrChart'
import MangalDiwasQuarterlyBar from '../components/charts/MangalDiwasQuarterlyBar'
import PoshanTrackerLine from '../components/charts/PoshanTrackerLine'
import SamUpliftedDonut from '../components/charts/SamUpliftedDonut'
import MalnutritionReductionBar from '../components/charts/MalnutritionReductionBar'

import { toLakh, formatIndian, formatPct } from '../utils/formatters'
import {
  getAyushThrData,
  getAyushThrTargetActual,
  getMangalDiwasKpi,
  getMangalDiwasQuarterly,
  getPoshanTrackerKpi,
  getPoshanTrackerByYear,
  getSamState,
  getSamByRegion,
  getSamByDistrict,
  getSamByBlock,
  getSamByAnganwadi
} from '../utils/aggregations'

/**
 * WCD Page 2 — Health & Adolescent Nutrition
 */
export default function HealthNutrition() {
  const store = useWcdStore()
  const {
    districts, rawAyush, rawMangal, rawPoshan,
    compiledRollup, compiledDistricts, loadCompiledDistrict,
    selectedFY, selectedRegion, selectedDistrict,
    setFY, setRegion, setDistrict
  } = store

  // Local state for SAM drilldown (scoped to SAM section, doesn't affect top cards)
  const [selectedBlock, setSelectedBlock] = React.useState(null)
  const [selectedAnganwadi, setSelectedAnganwadi] = React.useState(null)

  // Find active district code
  const activeDistrictObj = React.useMemo(() => {
    if (!selectedDistrict || !districts) return null
    return districts.find(d => d.district_name === selectedDistrict)
  }, [selectedDistrict, districts])

  const activeDistCode = activeDistrictObj?.district_code

  // Trigger lazy loading of per-district file whenever district is selected
  React.useEffect(() => {
    if (activeDistCode) {
      loadCompiledDistrict(activeDistCode)
    } else {
      setSelectedBlock(null)
      setSelectedAnganwadi(null)
    }
  }, [activeDistCode, loadCompiledDistrict])

  // Reset local block selection when region or district changes
  React.useEffect(() => {
    setSelectedBlock(null)
    setSelectedAnganwadi(null)
  }, [selectedRegion, selectedDistrict])

  if (!districts || !compiledRollup) return null

  const filters = { selectedFY, selectedRegion, selectedDistrict }

  // --- Row 1 KPI Calculations ---

  // 1. AYUSH THR KPI: FY-independent (all-time sum across 2022-23 to 2025-26)
  //    Fix D: KPI stays constant regardless of selectedFY.
  const ayushAllTimeData = getAyushThrData(rawAyush, { selectedFY: null, selectedRegion, selectedDistrict }, districts)
  const activeAyushData = ayushAllTimeData.filter(d => {
    if (selectedDistrict) return d.name.toLowerCase() === selectedDistrict.toLowerCase()
    if (selectedRegion) return d.inRegion
    return true
  })
  const ayushActual = activeAyushData.reduce((sum, d) => sum + (d.actual || 0), 0)
  const ayushTarget = activeAyushData.reduce((sum, d) => sum + (d.target || 0), 0)
  const hasAyushPilot = ayushTarget > 0

  // 2. Mangal Diwas
  const mangalKpi = getMangalDiwasKpi(rawMangal, filters, districts)

  // 3. Poshan Tracker (Fix F: defaults to 2025-26 when no FY selected)
  const poshanKpi = getPoshanTrackerKpi(rawPoshan, filters, districts)

  // --- Row 2 Chart Data ---
  // AYUSH THR chart: responds to selectedFY (Fix D)
  const ayushChartData = getAyushThrTargetActual(rawAyush, selectedFY, selectedRegion, selectedDistrict, districts)
  const mangalQuarterlyData = getMangalDiwasQuarterly(rawMangal, filters, districts)
  const poshanLineData = getPoshanTrackerByYear(rawPoshan, filters, districts)

  // --- Row 3 SAM Section Data & Drill Level ---
  let samDrillLevel = 0
  if (selectedRegion) samDrillLevel = 1
  if (selectedDistrict) samDrillLevel = 2
  if (selectedBlock) samDrillLevel = 3

  let donutSamData = null
  let barSamData = []

  const distCompiledData = activeDistCode ? compiledDistricts[activeDistCode] : null

  if (selectedBlock && distCompiledData) {
    // Level 3: Block selected -> show Anganwadi breakdown
    const awRows = getSamByAnganwadi(distCompiledData, selectedBlock)
    barSamData = awRows.map(r => ({
      name: r.anganwadi_name,
      female_delta: r.female_delta,
      male_delta: r.male_delta,
      total_delta: r.total_delta,
      female_apr: r.female_apr,
      male_apr: r.male_apr,
    }))

    // Donut stat summary for this block
    // Fix B: Pass female_apr/male_apr for the stat block
    const fDeltaSum = awRows.reduce((s, r) => s + (r.female_delta || 0), 0)
    const mDeltaSum = awRows.reduce((s, r) => s + (r.male_delta || 0), 0)
    const fAprSum = awRows.reduce((s, r) => s + (r.female_apr || 0), 0)
    const mAprSum = awRows.reduce((s, r) => s + (r.male_apr || 0), 0)

    donutSamData = {
      female_delta: fDeltaSum,
      male_delta: mDeltaSum,
      total_delta: fDeltaSum + mDeltaSum,
      female_apr: fAprSum,
      male_apr: mAprSum,
    }
  } else if (selectedDistrict && distCompiledData) {
    // Level 2: District selected -> show Block breakdown
    barSamData = getSamByBlock(distCompiledData)
    const distRow = compiledRollup.find(r => r.level === 'district' && r.dist_code === activeDistCode)
    donutSamData = distRow || null
  } else if (selectedRegion) {
    // Level 1: Region selected -> show District breakdown
    barSamData = getSamByDistrict(compiledRollup, selectedRegion)
    const regRow = compiledRollup.find(r => r.level === 'region' && r.name === selectedRegion)
    donutSamData = regRow || null
  } else {
    // Level 0: All Regions / State level
    barSamData = getSamByRegion(compiledRollup)
    donutSamData = getSamState(compiledRollup)
  }

  // --- Handlers for SAM Bar Click ---
  const handleSamBarClick = (item) => {
    if (samDrillLevel === 0) {
      setRegion(item.name)
    } else if (samDrillLevel === 1) {
      if (item.dist_code) {
        setDistrict(item.name)
        loadCompiledDistrict(item.dist_code)
      }
    } else if (samDrillLevel === 2) {
      setSelectedBlock(item.block_name || item.name)
    } else if (samDrillLevel === 3) {
      setSelectedAnganwadi(item.anganwadi_name || item.name)
    }
  }

  const handleSamBreadcrumbClick = (targetLevel) => {
    if (targetLevel === 0) {
      setRegion(null)
      setSelectedBlock(null)
      setSelectedAnganwadi(null)
    } else if (targetLevel === 1) {
      setDistrict(null)
      setSelectedBlock(null)
      setSelectedAnganwadi(null)
    } else if (targetLevel === 2) {
      setSelectedBlock(null)
      setSelectedAnganwadi(null)
    }
  }

  // AYUSH KPI subtitle
  const ayushSubtitle = hasAyushPilot
    ? `(Pilot in ${selectedDistrict ? '1 District' : (selectedRegion ? 'Region' : '6 Districts')}, 2022-23 to 2025-26)`
    : 'AYUSH THR pilot is active in 6 pilot districts only'

  return (
    <DashboardLayout pageSubtitle="Health & Adolescent Nutrition" sidebarTopSlot="fy-grid">
      {/* 3 KPI Cards (Row 1 Grid) */}
      <div className="wcd-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {/* 1. AYUSH THR — Fix D: FY-independent KPI */}
        <div className="wcd-kpi-card wcd-kpi-card--green">
          <div className="wcd-kpi-card__header">
            AYUSH THR<br/><strong>Beneficiaries</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            {hasAyushPilot ? (
              <div className="wcd-kpi-card__value wcd-kpi-card__value--green">
                {toLakh(ayushActual)}
                <span className="wcd-kpi-card__unit">Lakh</span>
              </div>
            ) : (
              <div className="wcd-kpi-card__value" style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
                No AYUSH THR data for this district
              </div>
            )}
          </div>
          <div className="wcd-kpi-card__detail">{ayushSubtitle}</div>
        </div>

        {/* 2. Mangal Diwas */}
        <div className="wcd-kpi-card wcd-kpi-card--blue">
          <div className="wcd-kpi-card__header">
            Beneficiaries Covered under<br/><strong>Mangal Diwas</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            {mangalKpi.hasData ? (
              <div className="wcd-kpi-card__value wcd-kpi-card__value--blue">
                {toLakh(mangalKpi.actual)}
                <span className="wcd-kpi-card__unit">Lakh</span>
              </div>
            ) : (
              <div className="wcd-kpi-card__value" style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
                No data for this selection
              </div>
            )}
          </div>
          <div className="wcd-kpi-card__detail">
            {selectedFY ? `(${selectedFY})` : '(2024-25 to 2025-26)'}
          </div>
        </div>

        {/* 3. Poshan Tracker — Fix F: defaults to 2025-26 */}
        <div className="wcd-kpi-card wcd-kpi-card--purple">
          <div className="wcd-kpi-card__header">
            Children Registered on<br/><strong>Poshan Tracker (0-5 Yrs)</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            {poshanKpi.hasData ? (
              <div className="wcd-kpi-card__value wcd-kpi-card__value--purple">
                {toLakh(poshanKpi.total_registered)}
                <span className="wcd-kpi-card__unit">Lakh</span>
              </div>
            ) : (
              <div className="wcd-kpi-card__value" style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
                No data for this selection
              </div>
            )}
          </div>
          <div className="wcd-kpi-card__detail">
            {selectedFY ? `(${selectedFY})` : '(2025-26)'}
          </div>
        </div>
      </div>

      {/* Row 2: 3 Charts (33% / 33% / 33%) */}
      <div className="wcd-grid-row" style={{ marginTop: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AyushThrChart
            data={ayushChartData}
            selectedFY={selectedFY}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MangalDiwasQuarterlyBar data={mangalQuarterlyData} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PoshanTrackerLine data={poshanLineData} />
        </div>
      </div>

      {/* Row 3: SAM Uplifted Section (Donut + Malnutrition Reduction Bar Chart) */}
      <div className="wcd-grid-row" style={{ marginTop: 16 }}>
        <div className="wcd-grid-col-40">
          <SamUpliftedDonut samData={donutSamData} />
        </div>
        <div className="wcd-grid-col-60">
          <MalnutritionReductionBar
            data={barSamData}
            drillLevel={samDrillLevel}
            selectedRegion={selectedRegion}
            selectedDistrict={selectedDistrict}
            selectedBlock={selectedBlock}
            onBarClick={handleSamBarClick}
            onBreadcrumbClick={handleSamBreadcrumbClick}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
