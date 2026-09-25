import React from 'react'
import useWcdStore from '../context/WcdStore'
import DashboardLayout from '../components/layout/DashboardLayout'
import BbbpMonthlyBar from '../components/charts/BbbpMonthlyBar'
import GirlsTrainedCombo from '../components/charts/GirlsTrainedCombo'
import AyushDistrictBar from '../components/charts/AyushDistrictBar'
import VahaliDikariMap from '../components/charts/VahaliDikariMap'
import { toLakh, formatIndian, formatPct } from '../utils/formatters'
import { 
  getActiveAnganwadis, getAvgGirlsTrained, getTotalBbbpPrograms, 
  getTotalVahaliDikari, getGirlsTrainedComboData, getBbbpMonthlyData, 
  getAyushThrData, getVahaliMapData 
} from '../utils/aggregations'

/**
 * WCD Overview Page — Asymmetric 2x2 Grid Layout
 * Arranges charts so GirlsTrainedCombo gets 60% width for optimal breathing room!
 */
export default function Overview() {
  const store = useWcdStore()
  const {
    districts, gujaratTopo, rawAyush, rawBbbp, rawVahali, rawGirls,
    selectedFY, selectedRegion, selectedDistrict,
    setFY, setRegion, setDistrict,
    clearFY, clearRegion
  } = store

  const [girlsDrillLevel, setGirlsDrillLevel] = React.useState('time')
  const [bbbpDrillLevel, setBbbpDrillLevel] = React.useState('time')

  React.useEffect(() => {
    if (!selectedFY) {
      setGirlsDrillLevel('time');
      setBbbpDrillLevel('time');
    }
  }, [selectedFY]);

  React.useEffect(() => {
    if (!selectedRegion) {
      if (girlsDrillLevel === 'district') setGirlsDrillLevel('region');
      if (bbbpDrillLevel === 'district') setBbbpDrillLevel('region');
    }
  }, [selectedRegion, girlsDrillLevel, bbbpDrillLevel]);

  const handleGirlsBarClick = (name) => {
    if (girlsDrillLevel === 'time') {
      setFY(name);
      setGirlsDrillLevel('region');
    } else if (girlsDrillLevel === 'region') {
      setRegion(name);
      setGirlsDrillLevel('district');
    } else if (girlsDrillLevel === 'district') {
      setDistrict(name);
    }
  }

  const handleBbbpBarClick = (name) => {
    if (bbbpDrillLevel === 'time') {
      // time level for BBBP is months, clicking a month doesn't set FY.
      // Wait, can clicking a month set selectedMonth? There is no selectedMonth.
      // I'll just do nothing at time level for BBBP.
    } else if (bbbpDrillLevel === 'region') {
      setRegion(name);
      setBbbpDrillLevel('district');
    } else if (bbbpDrillLevel === 'district') {
      setDistrict(name);
    }
  }

  if (!districts || !rawAyush) return null

  const filters = { selectedFY, selectedRegion, selectedDistrict }

  // Compute Aggregations dynamically
  const activeAnganwadis = getActiveAnganwadis(districts, filters)
  const avgGirlsTrained = getAvgGirlsTrained(rawGirls, filters, districts)
  const totalBbbp = getTotalBbbpPrograms(rawBbbp, filters, districts)
  const totalVahali = getTotalVahaliDikari(rawVahali, filters, districts)
  const ayushPctData = getAyushThrData(rawAyush, filters, districts)
  
  // Overall AYUSH THR % logic based on active geo
  const activeAyushData = ayushPctData.filter(d => {
    if (selectedDistrict) return d.name.toLowerCase() === selectedDistrict.toLowerCase();
    if (selectedRegion) return d.inRegion;
    return true;
  });
  
  const ayushActual = activeAyushData.reduce((sum, d) => sum + (d.actual || 0), 0)
  const ayushTarget = activeAyushData.reduce((sum, d) => sum + (d.target || 0), 0)
  const totalAyushPct = ayushTarget > 0 ? (ayushActual / ayushTarget) * 100 : 0
  
  // Note: we recompute overall Ayush here using the data returned from getAyushThrData
  // Wait, getAyushThrData returns {name, pct, hasPilot}. The actual/target are not returned.
  // I should update getAyushThrData to return actual/target too, or recompute here.
  // Actually, I'll update getAyushThrData to return actual and target.


  return (
    <DashboardLayout pageSubtitle="Overview" sidebarTopSlot="stat-cards">
      {/* Mission Statement Banner */}
      <div className="wcd-banner">
        <div className="wcd-banner__text">
          The department ensures children's nutrition and empowers women to live with dignity,
          promoting their nutrition, development, and well-being in an environment free from
          violence and discrimination
        </div>
      </div>



      {/* 5 KPI Cards (Single Row Grid) */}
      <div className="wcd-kpi-grid">
        {/* 1. Avg Girls Trained / Month */}
        <div className="wcd-kpi-card wcd-kpi-card--teal">
          <div className="wcd-kpi-card__header">
            Average adolescent girls trained <strong>per Month</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            <div className="wcd-kpi-card__value wcd-kpi-card__value--teal">
              {toLakh(avgGirlsTrained)}
              <span className="wcd-kpi-card__unit">Lakh</span>
            </div>
          </div>
          <div className="wcd-kpi-card__badge wcd-kpi-card__badge--teal">
            {selectedFY ? selectedFY : "All Years"}
          </div>
        </div>

        {/* 2. Active Anganwadis */}
        <div className="wcd-kpi-card wcd-kpi-card--blue">
          <div className="wcd-kpi-card__header">Active Anganwadis</div>
          <div className="wcd-kpi-card__main-row">
            <div className="wcd-kpi-card__value wcd-kpi-card__value--blue">
              {formatIndian(activeAnganwadis.total)}
            </div>
          </div>
          <div className="wcd-kpi-card__sub-values">
            <span>Rural <strong>{formatIndian(activeAnganwadis.rural)}</strong></span>
            <span>|</span>
            <span>Urban <strong>{formatIndian(activeAnganwadis.urban)}</strong></span>
          </div>
        </div>

        {/* 3. Total BBBP Programs */}
        <div className="wcd-kpi-card wcd-kpi-card--purple">
          <div className="wcd-kpi-card__header">
            Awareness programs under <strong>Beti Bachao Beti Padhao</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            <div className="wcd-kpi-card__value wcd-kpi-card__value--purple">
              {formatIndian(totalBbbp)}
            </div>
          </div>
          <div className="wcd-kpi-card__detail">
            ({selectedFY || "From 2020-21 to 2025-26"})
          </div>
        </div>

        {/* 4. Vahali Dikari Beneficiaries */}
        <div className="wcd-kpi-card wcd-kpi-card--orange">
          <div className="wcd-kpi-card__header">
            Beneficiaries of <strong>Vahali Dikari Yojana</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            <div className="wcd-kpi-card__value wcd-kpi-card__value--orange">
              {toLakh(totalVahali)}
              <span className="wcd-kpi-card__unit">Lakh</span>
            </div>
          </div>
          <div className="wcd-kpi-card__detail">
            ({selectedFY || "From 2020-21 to 2025-26"})
          </div>
        </div>

        {/* 5. AYUSH THR Achievement */}
        <div className="wcd-kpi-card wcd-kpi-card--green">
          <div className="wcd-kpi-card__header">
            Mothers receiving ration through <strong>AYUSH THR</strong>
          </div>
          <div className="wcd-kpi-card__main-row">
            <div className="wcd-kpi-card__value wcd-kpi-card__value--green">
              {formatPct(totalAyushPct)}
            </div>
          </div>
          <div className="wcd-kpi-card__detail">
            (Pilot in {selectedDistrict ? '1 District' : (selectedRegion ? 'Region' : '6 Districts')})
          </div>
        </div>
      </div>

      {/* 2x2 Asymmetric Chart Container */}
      <div className="wcd-grid-2x2">
        {/* Row 1: Girls Trained Combo (60%) + AYUSH THR District Bar (40%) */}
        <div className="wcd-grid-row">
          <div className="wcd-grid-col-60">
            <GirlsTrainedCombo 
              data={getGirlsTrainedComboData(rawGirls, filters, districts, girlsDrillLevel)} 
              drillLevel={girlsDrillLevel}
              selectedFY={selectedFY}
              selectedRegion={selectedRegion}
              onBarClick={handleGirlsBarClick}
              onBreadcrumbClick={(level) => {
                if (level === 'time') { setGirlsDrillLevel('time'); clearFY(); }
                if (level === 'region') { setGirlsDrillLevel('region'); clearRegion(); }
              }}
            />
          </div>
          <div className="wcd-grid-col-40">
            <AyushDistrictBar 
              data={ayushPctData}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
              onDistrictClick={setDistrict}
            />
          </div>
        </div>

        {/* Row 2: BBBP Monthly Spread (60%) + Vahali Dikari Gujarat Map (40%) */}
        <div className="wcd-grid-row">
          <div className="wcd-grid-col-60">
            <BbbpMonthlyBar 
              data={getBbbpMonthlyData(rawBbbp, filters, districts, bbbpDrillLevel)} 
              drillLevel={bbbpDrillLevel}
              selectedFY={selectedFY}
              selectedRegion={selectedRegion}
              onBarClick={handleBbbpBarClick}
              onBreadcrumbClick={(level) => {
                if (level === 'time') { setBbbpDrillLevel('time'); clearFY(); }
                if (level === 'region') { setBbbpDrillLevel('region'); clearRegion(); }
              }}
            />
          </div>
          <div className="wcd-grid-col-40">
            <VahaliDikariMap
              topoData={gujaratTopo}
              districtData={getVahaliMapData(rawVahali, filters, districts)}
              districts={districts}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
              onDistrictClick={setDistrict}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
