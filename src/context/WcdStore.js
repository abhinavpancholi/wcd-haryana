import { create } from 'zustand'

/**
 * WCD Dashboard Store — Zustand
 * Loads JSON data files produced by the ETL script (wcd_etl.py).
 * Files sourced from NSWLD-01 through NSWLD-34 + compiled + config + aggregates.
 */
const useWcdStore = create((set, get) => ({
  // State
  loading: true,
  error: null,
  config: null,          // wcdConfig.json
  districts: null,       // districts.json (with regions)
  overviewAggregates: null, // NSWLD-overview-aggregates.json
  gujaratTopo: null,     // haryana_districts.geojson (GeoJSON)
  haryanaGeoJson: null,

  // Raw Data for filtering
  rawAyush: null,        // NSWLD-01.json
  rawBbbp: null,         // NSWLD-10.json
  rawVahali: null,       // NSWLD-10_2.json
  rawGirls: null,        // NSWLD-12.json
  rawSensitizationState: null, // NSWLD-29.json
  rawSetu: null,         // NSWLD-30.json
  rawSexualHarassment: null, // NSWLD-34.json
  rawHostels: null,      // NSWLD-05.json (Page 4: Working Women Hostels)
  rawRescue: null,       // NSWLD-08.json (Page 4: Rescue Vans / 181 Helpline)
  rawMSY: null,          // NSWLD-17.json (Page 4: Mahila Swavlamban Yojana)
  rawJagruti: null,      // NSWLD-17_2.json (Page 4: Jagruti Shibir)
  compiledRollup: null,  // compiled-region-district-rollup.json
  compiledDistricts: {}, // per-district cache: { [dist_code]: [...] }

  // Filter State
  selectedFY: null,
  selectedRegion: null,
  selectedDistrict: null,

  // Actions
  initData: async () => {
    try {
      set({ loading: true, error: null })

      const [
        configRes, districtsRes, aggregatesRes, topoRes,
        ayushRes, bbbpRes, vahaliRes, girlsRes,
        compiledRollupRes, mangalRes, poshanRes,
        sensitizationStateRes, setuRes, sexualHarassmentRes,
        hostelsRes, rescueRes, msyRes, jagrutiRes
      ] = await Promise.all([
        fetch('/data/wcdConfig.json'),
        fetch('/data/districts.json'),
        fetch('/data/NSWLD-overview-aggregates.json'),
        fetch('/data/haryana_districts.geojson'),
        fetch('/data/NSWLD-01.json'),
        fetch('/data/NSWLD-10.json'),
        fetch('/data/NSWLD-10_2.json'),
        fetch('/data/NSWLD-12.json'),
        fetch('/data/compiled-region-district-rollup.json'),
        fetch('/data/NSWLD-02.json'),
        fetch('/data/NSWLD-13.json'),
        fetch('/data/NSWLD-29.json'),
        fetch('/data/NSWLD-30.json'),
        fetch('/data/NSWLD-34.json'),
        fetch('/data/NSWLD-05.json'),
        fetch('/data/NSWLD-08.json'),
        fetch('/data/NSWLD-17.json'),
        fetch('/data/NSWLD-17_2.json'),
      ])

      if (!configRes.ok || !districtsRes.ok || !aggregatesRes.ok || !topoRes.ok || !ayushRes.ok || !bbbpRes.ok || !vahaliRes.ok || !girlsRes.ok || !compiledRollupRes.ok || !mangalRes.ok || !poshanRes.ok || !sensitizationStateRes.ok || !setuRes.ok || !sexualHarassmentRes.ok || !hostelsRes.ok || !rescueRes.ok || !msyRes.ok || !jagrutiRes.ok) {
        throw new Error('Failed to load one or more data files')
      }

      const [
        config, districts, overviewAggregates, gujaratTopo,
        rawAyush, rawBbbp, rawVahali, rawGirls,
        compiledRollup, rawMangal, rawPoshan,
        rawSensitizationState, rawSetu, rawSexualHarassment,
        rawHostels, rawRescue, rawMSY, rawJagruti
      ] = await Promise.all([
        configRes.json(),
        districtsRes.json(),
        aggregatesRes.json(),
        topoRes.json(),
        ayushRes.json(),
        bbbpRes.json(),
        vahaliRes.json(),
        girlsRes.json(),
        compiledRollupRes.json(),
        mangalRes.json(),
        poshanRes.json(),
        sensitizationStateRes.json(),
        setuRes.json(),
        sexualHarassmentRes.json(),
        hostelsRes.json(),
        rescueRes.json(),
        msyRes.json(),
        jagrutiRes.json(),
      ])

      set({
        config,
        districts,
        overviewAggregates,
        gujaratTopo,
        haryanaGeoJson: gujaratTopo,
        rawAyush,
        rawBbbp,
        rawVahali,
        rawGirls,
        compiledRollup,
        rawMangal,
        rawPoshan,
        rawSensitizationState,
        rawSetu,
        rawSexualHarassment,
        rawHostels,
        rawRescue,
        rawMSY,
        rawJagruti,
        loading: false,
      })
    } catch (err) {
      console.error('WCD Store init error:', err)
      set({ error: err.message, loading: false })
    }
  },

  loadCompiledDistrict: async (dist_code) => {
    if (!dist_code) return [];
    const { compiledDistricts } = get();
    if (compiledDistricts[dist_code]) {
      return compiledDistricts[dist_code];
    }
    try {
      const res = await fetch(`/data/compiled-district/${dist_code}.json`);
      if (!res.ok) throw new Error(`Failed to load compiled district data for ${dist_code}`);
      const data = await res.json();
      set((state) => ({
        compiledDistricts: {
          ...state.compiledDistricts,
          [dist_code]: data
        }
      }));
      return data;
    } catch (err) {
      console.error(`Error loading compiled district ${dist_code}:`, err);
      return [];
    }
  },

  setFY: (fy) => set((state) => ({
    selectedFY: state.selectedFY === fy ? null : fy
  })),

  setRegion: (region) => set((state) => ({
    selectedRegion: state.selectedRegion === region ? null : region,
    selectedDistrict: null // Clearing district because it was scoped under region
  })),

  setDistrict: (district) => set((state) => {
    if (state.selectedDistrict === district) {
      // Toggle off district, keep region as is
      return { selectedDistrict: null };
    }

    // Find the region for this district
    const districtObj = state.districts?.find(d => d.district_name === district);
    const region = districtObj ? districtObj.region : state.selectedRegion;

    return {
      selectedDistrict: district,
      selectedRegion: region
    };
  }),

  resetFilters: () => set({
    selectedFY: null,
    selectedRegion: null,
    selectedDistrict: null
  }),
}))

export default useWcdStore
