export const REQUIRED_VOTER_SLIP_FIELDS = [
  "partNo",
  "serialNumber",
  "name",
  "father",
  "address",
  "sex",
  "age",
  "pollingStation",
];

export function canUseManualCalibration(meta) {
  return Boolean(
    meta?.permissions?.isAdmin && meta?.permissions?.canUseManualCalibration,
  );
}

export function normalizeManualBoxesForApi(boxes, defaults = {}) {
  const {
    align = "left",
    maxLines = 2,
    maxFontSize = 14,
    minFontSize = 9,
    paddingX = 0,
    paddingY = 0,
  } = defaults;

  return (boxes || []).map((box, index) => ({
    id: String(box?.id || `box-${index + 1}`),
    label: String(box?.label || ""),
    x: Number(box?.x || 0),
    y: Number(box?.y || 0),
    width: Number(box?.width || 0),
    height: Number(box?.height || 0),
    align: box?.align || align,
    maxLines: Number(box?.maxLines ?? maxLines),
    maxFontSize: Number(box?.maxFontSize ?? maxFontSize),
    minFontSize: Number(box?.minFontSize ?? minFontSize),
    paddingX: Number(box?.paddingX ?? paddingX),
    paddingY: Number(box?.paddingY ?? paddingY),
  }));
}

export function inferAutoLabelRows(response, selectedBoxes = []) {
  const source = response?.mapping || response?.labels || response || {};
  const rows = [];

  if (Array.isArray(source)) {
    source.forEach((entry, idx) => {
      const boxId = String(
        entry?.boxId || entry?.id || selectedBoxes[idx]?.id || "",
      );
      if (!boxId) return;
      rows.push({
        id: `map-${boxId}`,
        field: String(entry?.field || entry?.label || ""),
        boxId,
        boxIndex: Number(entry?.boxIndex ?? idx + 1),
        source: String(entry?.source || "auto"),
        confidence:
          entry?.confidence == null
            ? null
            : Number(entry.confidence).toFixed(2),
      });
    });
    return rows;
  }

  if (typeof source === "object" && source !== null) {
    Object.entries(source).forEach(([field, value], idx) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const boxId = String(value.boxId || value.id || "");
        if (!boxId) return;
        rows.push({
          id: `map-${boxId}`,
          field,
          boxId,
          boxIndex: Number(value.boxIndex ?? idx + 1),
          source: String(value.source || "auto"),
          confidence:
            value.confidence == null
              ? null
              : Number(value.confidence).toFixed(2),
        });
        return;
      }

      const boxId = String(value || "");
      if (!boxId) return;
      rows.push({
        id: `map-${boxId}`,
        field,
        boxId,
        boxIndex: idx + 1,
        source: "auto",
        confidence: null,
      });
    });
  }

  return rows;
}

export function applyMappingRowsToBoxes(boxes = [], mappingRows = []) {
  const fieldByBoxId = {};
  mappingRows.forEach((row) => {
    if (!row?.boxId) return;
    fieldByBoxId[String(row.boxId)] = String(row.field || "");
  });

  return boxes.map((box) => ({
    ...box,
    label: fieldByBoxId[String(box.id)] || box.label || "",
  }));
}

export function validateUniqueFieldAssignments(
  mappingRows = [],
  requiredFields = REQUIRED_VOTER_SLIP_FIELDS,
) {
  const used = new Map();
  for (const row of mappingRows) {
    const field = String(row?.field || "").trim();
    if (!field) continue;
    if (used.has(field)) {
      return {
        valid: false,
        reason: `Field ${field} is mapped more than once.`,
      };
    }
    used.set(field, row.boxId);
  }

  const missing = requiredFields.filter((field) => !used.has(field));
  if (missing.length) {
    return {
      valid: false,
      reason: `Missing field mappings: ${missing.join(", ")}`,
    };
  }

  return { valid: true, reason: "" };
}

export function buildFieldsPayloadFromBoxes(boxes = [], requiredFields = []) {
  const fields = {};
  boxes.forEach((box) => {
    const label = String(box?.label || "");
    if (!label) return;
    if (requiredFields.length > 0 && !requiredFields.includes(label)) return;

    fields[label] = {
      x: Number(box?.x || 0),
      y: Number(box?.y || 0),
      width: Number(box?.width || 0),
      height: Number(box?.height || 0),
      align: String(box?.align || "left"),
      maxLines: Number(box?.maxLines ?? 2),
      maxFontSize: Number(box?.maxFontSize ?? 14),
      minFontSize: Number(box?.minFontSize ?? 9),
      paddingX: Number(box?.paddingX ?? 0),
      paddingY: Number(box?.paddingY ?? 0),
    };
  });

  return fields;
}
