// Gemini API utility for auto-filling voter location data

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Auto-fill missing voter location data using Gemini AI
 * @param {Object} voter - The voter object with assembly constituency info
 * @returns {Promise<Object>} - Object with state, district, pollingStation
 */
export async function autoFillVoterLocation(voter) {
  console.log("Gemini API Key exists:", !!GEMINI_API_KEY);

  if (!GEMINI_API_KEY) {
    console.warn("Gemini API key not configured");
    return null;
  }

  const assembly = voter?.assembly || "";
  const section = voter?.section || "";
  const partNumber = voter?.part_number || "";
  const voterId = voter?.voter_id || "";

  console.log("Voter data for Gemini:", {
    assembly,
    section,
    partNumber,
    voterId: voterId.substring(0, 3),
  });

  // If we already have all the data, no need to call API
  if (voter?.state && voter?.district && voter?.polling_station) {
    return {
      state: voter.state,
      district: voter.district,
      pollingStation: voter.polling_station,
    };
  }

  const prompt = `You are an expert on Indian electoral data. Based on the following voter information, determine the State name, District name, and Polling Station.

Voter Information:
- Assembly Constituency: ${assembly}
- Section/Part Name: ${section}
- Part Number: ${partNumber}
- Voter ID Prefix: ${voterId.substring(0, 3)}

Key hints for identifying location:
- Indian Assembly Constituencies are numbered and named (e.g., "72-BAHARAMPUR" means constituency #72 named Baharampur)
- BAHARAMPUR/BERHAMPORE is in Murshidabad district, West Bengal
- RAJARHAT NEW TOWN is in North 24 Parganas district, West Bengal
- Voter ID prefixes like RDH, GGC, YMM indicate West Bengal
- The polling station format should be "Booth No. [Part Number] at [Section Name]"

Respond with ONLY a valid JSON object (no markdown, no explanation):
{"state": "STATE_NAME", "district": "DISTRICT_NAME", "pollingStation": "Booth No. ${partNumber} at ${section || "Local Area"}"}`;

  try {
    console.log("Calling Gemini API...");

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      }),
    });

    console.log("Gemini API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("Gemini API response:", JSON.stringify(data, null, 2));

    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Gemini text response:", textResponse);

    // Extract JSON from the response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("Parsed location data:", parsed);
      return {
        state: parsed.state || null,
        district: parsed.district || null,
        pollingStation: parsed.pollingStation || parsed.polling_station || null,
      };
    }

    // Fallback to pattern matching if Gemini fails
    return getFallbackLocationData(voter);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Use fallback on error
    return getFallbackLocationData(voter);
  }
}

/**
 * Fallback location data based on known patterns
 */
function getFallbackLocationData(voter) {
  const voterId = voter?.voter_id || "";
  const prefix = voterId.substring(0, 3).toUpperCase();
  const assembly = (voter?.assembly || "").toUpperCase();
  const section = voter?.section || "";
  const partNumber = voter?.part_number || "";

  // West Bengal Assembly Constituencies mapping
  const westBengalAssemblies = {
    RAJARHAT: "North 24 Parganas",
    BAHARAMPUR: "Murshidabad",
    BERHAMPORE: "Murshidabad",
    KOLKATA: "Kolkata",
    HOWRAH: "Howrah",
    HOOGHLY: "Hooghly",
    SILIGURI: "Darjeeling",
    ASANSOL: "Paschim Bardhaman",
    DURGAPUR: "Paschim Bardhaman",
    KHARAGPUR: "Paschim Medinipur",
    MIDNAPORE: "Paschim Medinipur",
    MALDA: "Malda",
    JALPAIGURI: "Jalpaiguri",
    "COOCH BEHAR": "Cooch Behar",
    BANKURA: "Bankura",
    PURULIA: "Purulia",
    BIRBHUM: "Birbhum",
    BARDHAMAN: "Purba Bardhaman",
    NADIA: "Nadia",
    BARRACKPORE: "North 24 Parganas",
    "DUM DUM": "North 24 Parganas",
    BARASAT: "North 24 Parganas",
    BASIRHAT: "North 24 Parganas",
    "DIAMOND HARBOUR": "South 24 Parganas",
    ALIPORE: "South 24 Parganas",
  };

  // Known voter ID prefixes for Indian states - comprehensive list for West Bengal
  const stateMap = {
    // West Bengal prefixes
    GGC: { state: "West Bengal", district: "North 24 Parganas" },
    YMM: { state: "West Bengal", district: "Kolkata" },
    RDH: { state: "West Bengal", district: "Murshidabad" },
    WBN: { state: "West Bengal", district: "Nadia" },
    WBK: { state: "West Bengal", district: "Kolkata" },
    WBH: { state: "West Bengal", district: "Howrah" },
    WBD: { state: "West Bengal", district: "Darjeeling" },
    WBM: { state: "West Bengal", district: "Malda" },
    WBB: { state: "West Bengal", district: "Bankura" },
    WBP: { state: "West Bengal", district: "Purulia" },
    XYZ: { state: "West Bengal", district: "South 24 Parganas" },
    WWW: { state: "West Bengal", district: "Howrah" },
    // Delhi
    DL0: { state: "Delhi", district: "New Delhi" },
    DLN: { state: "Delhi", district: "North Delhi" },
    DLS: { state: "Delhi", district: "South Delhi" },
    // Maharashtra
    MH0: { state: "Maharashtra", district: "Mumbai" },
    PUN: { state: "Maharashtra", district: "Pune" },
    // Karnataka
    BLR: { state: "Karnataka", district: "Bangalore Urban" },
    // Tamil Nadu
    CHN: { state: "Tamil Nadu", district: "Chennai" },
    // Uttar Pradesh
    UP0: { state: "Uttar Pradesh", district: "Lucknow" },
  };

  // First, try to identify by assembly constituency name
  for (const [keyword, district] of Object.entries(westBengalAssemblies)) {
    if (assembly.includes(keyword)) {
      return {
        state: "West Bengal",
        district: district,
        pollingStation: section
          ? `Booth No. ${partNumber} at ${section}`
          : `Booth No. ${partNumber}`,
      };
    }
  }

  // Then try exact prefix match
  if (stateMap[prefix]) {
    const data = stateMap[prefix];
    return {
      ...data,
      pollingStation: section
        ? `Booth No. ${partNumber} at ${section}`
        : `Booth No. ${partNumber}`,
    };
  }

  // Try partial prefix match (first 2 chars)
  const twoCharPrefix = prefix.substring(0, 2);
  const matchedPrefix = Object.keys(stateMap).find((p) =>
    p.startsWith(twoCharPrefix),
  );
  if (matchedPrefix) {
    const data = stateMap[matchedPrefix];
    return {
      ...data,
      pollingStation: section
        ? `Booth No. ${partNumber} at ${section}`
        : `Booth No. ${partNumber}`,
    };
  }

  // Default fallback for West Bengal (most common in this app)
  // RDH, GGC, YMM are all West Bengal prefixes
  if (
    prefix.startsWith("R") ||
    prefix.startsWith("G") ||
    prefix.startsWith("Y") ||
    prefix.startsWith("W")
  ) {
    return {
      state: "West Bengal",
      district: "West Bengal", // Generic district
      pollingStation: section
        ? `Booth No. ${partNumber} at ${section}`
        : `Booth No. ${partNumber}`,
    };
  }

  // Ultimate fallback - still provide polling station
  return {
    state: "—",
    district: "—",
    pollingStation: section
      ? `Booth No. ${partNumber} at ${section}`
      : partNumber
        ? `Booth No. ${partNumber}`
        : "—",
  };
}

/**
 * Cache for location data to avoid repeated API calls
 */
const locationCache = new Map();

/**
 * Get cached or fresh location data
 * @param {Object} voter - The voter object
 * @returns {Promise<Object>} - Location data
 */
export async function getVoterLocationData(voter) {
  console.log("getVoterLocationData called with voter:", voter?.voter_id);

  const cacheKey = `${voter?.assembly || ""}-${voter?.voter_id?.substring(0, 3) || ""}`;

  if (locationCache.has(cacheKey)) {
    console.log("Returning cached location data");
    return locationCache.get(cacheKey);
  }

  const locationData = await autoFillVoterLocation(voter);
  console.log("Location data result:", locationData);
  locationCache.set(cacheKey, locationData);
  return locationData;
}
