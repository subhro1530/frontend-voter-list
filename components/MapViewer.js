import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

// State centers for initial positioning
const STATE_CENTERS = {
  "ANDHRA PRADESH": [15.9129, 79.74],
  "ARUNACHAL PRADESH": [28.218, 94.7278],
  ASSAM: [26.2006, 92.9376],
  BIHAR: [25.0961, 85.3131],
  CHHATTISGARH: [21.2787, 81.8661],
  DELHI: [28.6139, 77.209],
  GOA: [15.4909, 73.8278],
  GUJARAT: [22.2587, 71.1924],
  HARYANA: [29.0588, 76.0856],
  "HIMACHAL PRADESH": [31.1048, 77.1734],
  "JAMMU & KASHMIR": [33.7782, 76.5762],
  JHARKHAND: [23.6102, 85.2799],
  KARNATAKA: [15.3173, 75.7139],
  KERALA: [10.8505, 76.2711],
  "MADHYA PRADESH": [22.9734, 78.6569],
  MAHARASHTRA: [19.7515, 75.7139],
  MANIPUR: [24.6637, 93.9063],
  MEGHALAYA: [25.467, 91.3662],
  MIZORAM: [23.1645, 92.9376],
  NAGALAND: [26.1584, 94.5624],
  ORISSA: [20.9517, 85.0985],
  PUDUCHERRY: [11.9416, 79.8083],
  PUNJAB: [31.1471, 75.3412],
  RAJASTHAN: [27.0238, 74.2179],
  SIKKIM: [27.533, 88.5122],
  "TAMIL NADU": [11.1271, 78.6569],
  TRIPURA: [23.9408, 91.9882],
  "UTTAR PRADESH": [26.8467, 80.9462],
  UTTARKHAND: [30.0668, 79.0193],
  "WEST BENGAL": [22.9868, 87.855],
};

// Available states (matching filenames without .json)
const AVAILABLE_STATES = Object.keys(STATE_CENTERS);

// Color palette for constituencies
const CONSTITUENCY_COLORS = [
  "#8c2bff",
  "#4868bf",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#e879f9",
  "#22d3ee",
  "#a3e635",
  "#fb923c",
  "#818cf8",
];

function getConstituencyColor(index, total) {
  return CONSTITUENCY_COLORS[index % CONSTITUENCY_COLORS.length];
}

// Calculate centroid of a polygon
function getCentroid(coords) {
  let latSum = 0,
    lngSum = 0,
    count = 0;
  const ring = coords[0] || coords;
  ring.forEach(([lng, lat]) => {
    latSum += lat;
    lngSum += lng;
    count++;
  });
  return count ? [latSum / count, lngSum / count] : [0, 0];
}

// Calculate bounds of a GeoJSON feature collection
function getBounds(features) {
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;
  features.forEach((f) => {
    const geom = f.geometry;
    if (!geom || !geom.coordinates) return;
    const processCoords = (coords) => {
      if (!Array.isArray(coords)) return;
      coords.forEach((ring) => {
        if (!Array.isArray(ring)) return;
        if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
          processCoords(ring);
        } else {
          ring.forEach((point) => {
            if (!Array.isArray(point) || point.length < 2) return;
            const [lng, lat] = point;
            if (typeof lat === "number" && typeof lng === "number") {
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
              minLng = Math.min(minLng, lng);
              maxLng = Math.max(maxLng, lng);
            }
          });
        }
      });
    };
    if (geom.type === "Polygon") {
      processCoords(geom.coordinates);
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((poly) => processCoords(poly));
    }
  });
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

// Inner component that uses useMap() to safely access the Leaflet map instance
function MapController({ filteredFeatures, selectedState }) {
  const mapInstanceRef = useRef(null);
  const [rl, setRl] = useState(null);

  useEffect(() => {
    import("react-leaflet").then((mod) => setRl(mod));
  }, []);

  // We render a tiny component that calls useMap inside MapContainer context
  if (!rl) return null;

  const Inner = () => {
    const map = rl.useMap();
    mapInstanceRef.current = map;

    useEffect(() => {
      if (!map || !filteredFeatures || filteredFeatures.length === 0) return;
      // Small delay to ensure everything is rendered before fitting bounds
      const timer = setTimeout(() => {
        try {
          const bounds = getBounds(filteredFeatures);
          if (
            bounds[0][0] !== 90 &&
            bounds[1][0] !== -90 &&
            map.getContainer()
          ) {
            map.invalidateSize();
            map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
          }
        } catch (err) {
          console.warn("fitBounds skipped:", err.message);
        }
      }, 200);
      return () => clearTimeout(timer);
    }, [map, filteredFeatures, selectedState]);

    return null;
  };

  return <Inner />;
}

// The actual map component (client-side only)
function LeafletMap({
  geoData,
  selectedState,
  selectedConstituency,
  onConstituencyClick,
  onConstituencyHover,
  hoveredConstituency,
  searchQuery,
  filterPC,
  mapStyle,
}) {
  const geoJsonRef = useRef(null);
  const [L, setL] = useState(null);
  const [MapContainer, setMapContainer] = useState(null);
  const [TileLayer, setTileLayer] = useState(null);
  const [GeoJSON, setGeoJSON] = useState(null);
  const [ZoomControl, setZoomControl] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Load leaflet modules
  useEffect(() => {
    (async () => {
      const leaflet = await import("leaflet");
      const rl = await import("react-leaflet");
      setL(leaflet.default || leaflet);
      setMapContainer(() => rl.MapContainer);
      setTileLayer(() => rl.TileLayer);
      setGeoJSON(() => rl.GeoJSON);
      setZoomControl(() => rl.ZoomControl);
      setIsReady(true);
    })();
  }, []);

  // Filter features based on search and PC filter
  const filteredFeatures = useMemo(() => {
    if (!geoData?.features) return [];
    let features = geoData.features.filter(
      (f) => f.geometry && f.geometry.coordinates && f.properties,
    );
    if (filterPC && filterPC !== "all") {
      features = features.filter((f) => f.properties.PC_NAME === filterPC);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      features = features.filter(
        (f) =>
          f.properties.AC_NAME?.toLowerCase().includes(q) ||
          f.properties.PC_NAME?.toLowerCase().includes(q) ||
          f.properties.DIST_NAME?.toLowerCase().includes(q),
      );
    }
    return features;
  }, [geoData, searchQuery, filterPC]);

  // Tile layer URLs based on map style
  const tileUrl = useMemo(() => {
    switch (mapStyle) {
      case "satellite":
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      case "dark":
        return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      case "terrain":
        return "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
      default:
        return "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
    }
  }, [mapStyle]);

  // Style each feature
  const styleFeature = useCallback(
    (feature) => {
      if (!feature || !feature.properties) {
        return {
          fillColor: "#243365",
          weight: 1,
          opacity: 0.5,
          color: "#243365",
          fillOpacity: 0.2,
        };
      }
      const index = geoData?.features?.indexOf(feature) || 0;
      const isSelected =
        selectedConstituency?.properties?.AC_NO === feature.properties?.AC_NO &&
        selectedConstituency?.properties?.AC_NAME ===
          feature.properties?.AC_NAME;
      const isHovered =
        hoveredConstituency?.properties?.AC_NO === feature.properties?.AC_NO &&
        hoveredConstituency?.properties?.AC_NAME ===
          feature.properties?.AC_NAME;

      const baseColor = getConstituencyColor(
        index,
        geoData?.features?.length || 1,
      );

      return {
        fillColor: isSelected ? "#8c2bff" : isHovered ? "#a24bff" : baseColor,
        weight: isSelected ? 3 : isHovered ? 2.5 : 1.5,
        opacity: 1,
        color: isSelected ? "#e6c9ff" : isHovered ? "#d29dff" : "#243365",
        fillOpacity: isSelected ? 0.7 : isHovered ? 0.55 : 0.35,
        dashArray: isSelected ? "" : "",
      };
    },
    [geoData, selectedConstituency, hoveredConstituency],
  );

  // Feature event handlers
  const onEachFeature = useCallback(
    (feature, layer) => {
      if (!feature || !feature.properties) return;

      layer.on({
        mouseover: (e) => {
          onConstituencyHover(feature);
          try {
            e.target.setStyle({
              fillOpacity: 0.6,
              weight: 2.5,
              color: "#d29dff",
            });
            e.target.bringToFront();
          } catch (err) {
            // ignore style errors during transitions
          }
        },
        mouseout: (e) => {
          onConstituencyHover(null);
          try {
            if (geoJsonRef.current) {
              geoJsonRef.current.resetStyle(e.target);
            }
          } catch (err) {
            // ignore reset errors during transitions
          }
        },
        click: () => {
          onConstituencyClick(feature);
        },
      });

      // Create tooltip with the constituency name
      const name = feature.properties.AC_NAME || "Unknown";
      layer.bindTooltip(name, {
        permanent: false,
        direction: "top",
        className: "map-tooltip",
        offset: [0, -10],
      });
    },
    [onConstituencyClick, onConstituencyHover],
  );

  if (!isReady || !MapContainer) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-ink-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-neon-400 border-t-transparent"></div>
          <span className="text-slate-400 text-sm">Loading map engine...</span>
        </div>
      </div>
    );
  }

  const center = STATE_CENTERS[selectedState] || [22.9734, 78.6569];

  return (
    <MapContainer
      key={selectedState}
      center={center}
      zoom={7}
      zoomControl={false}
      className="w-full h-full"
      style={{ background: "#0b0f1d" }}
      whenReady={() => {}}
    >
      <MapController
        filteredFeatures={filteredFeatures}
        selectedState={selectedState}
      />
      <ZoomControl position="bottomright" />
      <TileLayer
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        opacity={mapStyle === "default" ? 0.4 : 0.7}
      />
      {filteredFeatures.length > 0 && (
        <GeoJSON
          ref={geoJsonRef}
          key={`${selectedState}-${filterPC}-${searchQuery}-${selectedConstituency?.properties?.AC_NO}`}
          data={{ type: "FeatureCollection", features: filteredFeatures }}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  );
}

// Dynamic import for SSR safety
const DynamicLeafletMap = dynamic(() => Promise.resolve(LeafletMap), {
  ssr: false,
});

// Constituency detail panel
function ConstituencyDetail({ feature, onClose, onDirections }) {
  if (!feature) return null;
  const props = feature.properties;
  const centroid = getCentroid(
    feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates,
  );

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-ink-200/95 backdrop-blur-xl border border-ink-400/70 rounded-2xl shadow-2xl z-[1000] animate-slideIn">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-neon-500/20 via-ink-200 to-ink-200 p-4 border-b border-ink-400/50 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-bold text-neon-100">
              {props.AC_NAME || "Unknown Area"}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              AC #{props.AC_NO}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-ink-100/80 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Location Info */}
        <div className="space-y-2">
          <DetailRow label="State" value={props.ST_NAME} icon="🏛️" />
          <DetailRow
            label="District"
            value={props.DIST_NAME || "N/A"}
            icon="📍"
          />
          <DetailRow
            label="Parliamentary Constituency"
            value={props.PC_NAME || "N/A"}
            icon="🗳️"
          />
          <DetailRow label="PC Number" value={props.PC_NO || "N/A"} icon="#️⃣" />
          <DetailRow
            label="Coordinates"
            value={`${centroid[0].toFixed(4)}°N, ${centroid[1].toFixed(4)}°E`}
            icon="🌐"
          />
          {props.Shape_Area && (
            <DetailRow
              label="Area"
              value={`${(props.Shape_Area * 12321).toFixed(2)} sq km (approx)`}
              icon="📐"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <button
            onClick={() => onDirections(centroid)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Get Directions (Google Maps)
          </button>
          <button
            onClick={() => {
              const url = `https://www.google.com/maps/@${centroid[0]},${centroid[1]},13z`;
              window.open(url, "_blank");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-100/80 hover:bg-ink-100 border border-ink-400 hover:border-neon-400 text-slate-200 rounded-xl text-sm font-semibold transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View in Google Maps
          </button>
          <button
            onClick={() => {
              const url = `https://www.google.com/maps/search/meeting+places+near+${centroid[0]},${centroid[1]}`;
              window.open(url, "_blank");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-100/80 hover:bg-ink-100 border border-ink-400 hover:border-neon-400 text-slate-200 rounded-xl text-sm font-semibold transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Find Meeting Places Nearby
          </button>
        </div>

        {/* Quick Stats from data */}
        <div className="pt-2 border-t border-ink-400/50">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Quick Info
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-ink-100/60 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-400">PC ID</p>
              <p className="text-sm font-bold text-neon-200">
                {props.PC_ID || "—"}
              </p>
            </div>
            <div className="bg-ink-100/60 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-bold text-emerald-300">
                {props.STATUS || "Active"}
              </p>
            </div>
            <div className="bg-ink-100/60 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-400">AC #</p>
              <p className="text-sm font-bold text-blue-300">{props.AC_NO}</p>
            </div>
            <div className="bg-ink-100/60 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-400">Perimeter</p>
              <p className="text-sm font-bold text-amber-300">
                {props.Shape_Leng
                  ? `${(props.Shape_Leng * 111).toFixed(1)} km`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          {label}
        </p>
        <p className="text-sm text-slate-200 font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// Hover tooltip
function HoverInfo({ feature }) {
  if (!feature) return null;
  const props = feature.properties;
  return (
    <div className="absolute bottom-4 left-4 bg-ink-200/95 backdrop-blur-xl border border-ink-400/70 rounded-xl px-4 py-3 z-[1000] shadow-xl max-w-xs">
      <p className="text-sm font-bold text-neon-100">
        {props.AC_NAME || "Unknown"}
      </p>
      <p className="text-xs text-slate-400">
        {props.PC_NAME || ""} • {props.DIST_NAME || props.ST_NAME || ""}
      </p>
    </div>
  );
}

// State selector panel
function StateSelectorPanel({
  states,
  selectedState,
  onSelectState,
  searchTerm,
  onSearchChange,
}) {
  const filteredStates = states.filter((s) =>
    s.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search states..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full bg-ink-100/80 border border-ink-400/70 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-400/50 focus:border-neon-400"
      />
      <div className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-thin">
        {filteredStates.map((state) => (
          <button
            key={state}
            onClick={() => onSelectState(state)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedState === state
                ? "bg-neon-500/20 text-neon-100 border border-neon-400/50"
                : "text-slate-300 hover:bg-ink-100/50 hover:text-slate-100"
            }`}
          >
            <span className="mr-2 text-xs">
              {selectedState === state ? "📍" : "📌"}
            </span>
            {state}
          </button>
        ))}
      </div>
    </div>
  );
}

// Main MapViewer component
export default function MapViewer() {
  const [selectedState, setSelectedState] = useState("DELHI");
  const [geoData, setGeoData] = useState(null);
  const [selectedConstituency, setSelectedConstituency] = useState(null);
  const [hoveredConstituency, setHoveredConstituency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [filterPC, setFilterPC] = useState("all");
  const [mapStyle, setMapStyle] = useState("default");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showConstituencyList, setShowConstituencyList] = useState(false);

  // Load GeoJSON data for selected state
  useEffect(() => {
    if (!selectedState) return;
    setLoading(true);
    setError(null);
    setSelectedConstituency(null);
    setFilterPC("all");
    setSearchQuery("");

    fetch(`/maps/${encodeURIComponent(selectedState)}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Map not found for ${selectedState}`);
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedState]);

  // Get unique PC names
  const pcNames = useMemo(() => {
    if (!geoData?.features) return [];
    const names = new Set();
    geoData.features.forEach((f) => {
      if (f.properties.PC_NAME) names.add(f.properties.PC_NAME);
    });
    return Array.from(names).sort();
  }, [geoData]);

  // Filtered constituencies for the list
  const filteredConstituencies = useMemo(() => {
    if (!geoData?.features) return [];
    let features = geoData.features;
    if (filterPC && filterPC !== "all") {
      features = features.filter((f) => f.properties.PC_NAME === filterPC);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      features = features.filter(
        (f) =>
          f.properties.AC_NAME?.toLowerCase().includes(q) ||
          f.properties.PC_NAME?.toLowerCase().includes(q),
      );
    }
    return features.sort(
      (a, b) => (a.properties.AC_NO || 0) - (b.properties.AC_NO || 0),
    );
  }, [geoData, filterPC, searchQuery]);

  // Handle constituency click
  const handleConstituencyClick = useCallback((feature) => {
    setSelectedConstituency((prev) =>
      prev?.properties?.AC_NO === feature.properties?.AC_NO &&
      prev?.properties?.AC_NAME === feature.properties?.AC_NAME
        ? null
        : feature,
    );
  }, []);

  // Handle directions
  const handleDirections = useCallback((centroid) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${centroid[0]},${centroid[1]}`;
    window.open(url, "_blank");
  }, []);

  // Stats summary
  const stats = useMemo(() => {
    if (!geoData?.features) return { total: 0, pcs: 0, filtered: 0, area: 0 };
    const pcs = new Set(geoData.features.map((f) => f.properties.PC_NAME));
    const totalArea = geoData.features.reduce(
      (sum, f) => sum + (f.properties.Shape_Area || 0),
      0,
    );
    return {
      total: geoData.features.length,
      pcs: pcs.size,
      filtered: filteredConstituencies.length,
      area: (totalArea * 12321).toFixed(0),
    };
  }, [geoData, filteredConstituencies]);

  return (
    <div className="relative w-full h-[calc(100vh-12rem)] min-h-[500px] rounded-2xl overflow-hidden border border-ink-400/70 bg-ink-100">
      {/* Top Controls Bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-ink-200/90 backdrop-blur-xl border-b border-ink-400/50">
        <div className="flex items-center gap-2 px-4 py-2.5">
          {/* Toggle sidebar */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg bg-ink-100/80 hover:bg-neon-500/20 border border-ink-400/50 hover:border-neon-400/50 text-slate-300 hover:text-neon-200 transition-all"
            title="Toggle sidebar"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search constituencies, districts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-ink-100/80 border border-ink-400/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-400/50"
            />
          </div>

          {/* PC Filter */}
          <select
            value={filterPC}
            onChange={(e) => setFilterPC(e.target.value)}
            className="bg-ink-100/80 border border-ink-400/50 rounded-lg px-2 py-1.5 text-sm text-slate-200 max-w-[200px] focus:outline-none focus:ring-2 focus:ring-neon-400/50"
          >
            <option value="all">All PCs</option>
            {pcNames.map((pc) => (
              <option key={pc} value={pc}>
                {pc}
              </option>
            ))}
          </select>

          {/* Map Style */}
          <div className="flex items-center gap-1 bg-ink-100/60 rounded-lg p-0.5 border border-ink-400/30">
            {[
              { id: "default", label: "🌙", title: "Dark" },
              { id: "satellite", label: "🛰️", title: "Satellite" },
              { id: "dark", label: "🗺️", title: "Labels" },
              { id: "terrain", label: "⛰️", title: "Terrain" },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => setMapStyle(style.id)}
                title={style.title}
                className={`px-2 py-1 rounded-md text-xs transition-all ${
                  mapStyle === style.id
                    ? "bg-neon-500/30 text-neon-100 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {/* Stats badges */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <span className="px-2 py-1 bg-neon-500/15 border border-neon-400/30 rounded-full text-xs text-neon-200 font-semibold">
              {stats.filtered}/{stats.total} ACs
            </span>
            <span className="px-2 py-1 bg-blue-500/15 border border-blue-400/30 rounded-full text-xs text-blue-200 font-semibold">
              {stats.pcs} PCs
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`absolute top-[52px] left-0 bottom-0 z-[999] w-64 bg-ink-200/95 backdrop-blur-xl border-r border-ink-400/50 transition-transform duration-300 ${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3 space-y-3 h-full flex flex-col">
          {/* State Header */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-neon-500/30 to-blue-500/30 rounded-lg flex items-center justify-center border border-neon-400/30">
              <span className="text-sm">🗺️</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-neon-100">
                {selectedState || "Select State"}
              </h3>
              <p className="text-[10px] text-slate-500">
                {stats.total} constituencies
              </p>
            </div>
          </div>

          {/* State Selector */}
          <StateSelectorPanel
            states={AVAILABLE_STATES}
            selectedState={selectedState}
            onSelectState={setSelectedState}
            searchTerm={stateSearchTerm}
            onSearchChange={setStateSearchTerm}
          />

          {/* Divider */}
          <div className="border-t border-ink-400/50" />

          {/* Constituency List Toggle */}
          <button
            onClick={() => setShowConstituencyList(!showConstituencyList)}
            className="flex items-center justify-between w-full px-3 py-2 bg-ink-100/60 rounded-lg text-sm font-semibold text-slate-200 hover:bg-ink-100 transition-all"
          >
            <span>Constituencies ({filteredConstituencies.length})</span>
            <svg
              className={`w-4 h-4 transition-transform ${
                showConstituencyList ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Constituency List */}
          {showConstituencyList && (
            <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin min-h-0">
              {filteredConstituencies.map((feature, i) => {
                const props = feature.properties;
                const isSelected =
                  selectedConstituency?.properties?.AC_NO === props.AC_NO &&
                  selectedConstituency?.properties?.AC_NAME === props.AC_NAME;
                return (
                  <button
                    key={`${props.AC_NO}-${props.AC_NAME}-${i}`}
                    onClick={() => handleConstituencyClick(feature)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      isSelected
                        ? "bg-neon-500/20 border border-neon-400/50 text-neon-100"
                        : "text-slate-300 hover:bg-ink-100/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: getConstituencyColor(
                            i,
                            filteredConstituencies.length,
                          ),
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {props.AC_NAME || "Unknown"}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          AC #{props.AC_NO} • {props.PC_NAME || ""}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div
        className={`absolute top-[52px] bottom-0 right-0 transition-all duration-300 ${
          showSidebar ? "left-64" : "left-0"
        }`}
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-ink-100">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-neon-400/30 border-t-neon-400"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl">🗺️</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-slate-200 font-semibold">
                  Loading {selectedState}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Fetching map data...
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center bg-ink-100">
            <div className="text-center max-w-sm">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-rose-300 font-semibold">{error}</p>
              <p className="text-slate-500 text-sm mt-2">
                Try selecting a different state
              </p>
            </div>
          </div>
        ) : geoData ? (
          <DynamicLeafletMap
            geoData={geoData}
            selectedState={selectedState}
            selectedConstituency={selectedConstituency}
            onConstituencyClick={handleConstituencyClick}
            onConstituencyHover={setHoveredConstituency}
            hoveredConstituency={hoveredConstituency}
            searchQuery={searchQuery}
            filterPC={filterPC}
            mapStyle={mapStyle}
          />
        ) : null}

        {/* Hover info */}
        <HoverInfo feature={hoveredConstituency} />

        {/* Selected constituency detail */}
        <ConstituencyDetail
          feature={selectedConstituency}
          onClose={() => setSelectedConstituency(null)}
          onDirections={handleDirections}
        />
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-[999] bg-ink-200/90 backdrop-blur-md border border-ink-400/50 rounded-xl px-3 py-2"
        style={{ left: showSidebar ? "calc(16rem + 1rem)" : "1rem" }}
      >
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
          {selectedState}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-neon-500/70 border border-neon-400"></span>
            Selected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-neon-400/40 border border-neon-300/50"></span>
            Hover
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-ink-400/60 border border-ink-300/50"></span>
            Default
          </span>
        </div>
      </div>
    </div>
  );
}
