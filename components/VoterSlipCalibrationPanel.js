import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../lib/api";
import {
  applyMappingRowsToBoxes,
  buildFieldsPayloadFromBoxes,
  inferAutoLabelRows,
  normalizeManualBoxesForApi as normalizeBoxesForApi,
  validateUniqueFieldAssignments,
} from "../lib/voterSlipCalibrationUtils";

const REQUIRED_FIELDS = [
  "partNo",
  "serialNumber",
  "name",
  "father",
  "address",
  "sex",
  "age",
  "pollingStation",
];

const FIELD_LABELS = {
  partNo: "Part No",
  serialNumber: "Serial Number",
  name: "Name",
  father: "Father/Husband",
  address: "Address",
  sex: "Sex",
  age: "Age",
  pollingStation: "Polling Station",
};

const DEFAULT_LAYOUT = {
  version: "default",
  meta: {
    source: "default",
    lastUpdated: null,
    coordinateSystem: "normalized-bottom-left",
    templateFile: "storage/voterslips/layout/template.png",
    layoutFileExists: false,
    permissions: {
      isAdmin: false,
      canCalibrate: false,
      canUseManualCalibration: false,
    },
    calibration: {
      requiredFields: REQUIRED_FIELDS,
      preferredMode: "default",
      endpoints: {
        saveManual: "/user/voterslips/layout/manual",
      },
    },
  },
  fields: {
    partNo: { x: 0.7, y: 0.73, width: 0.13, height: 0.07, align: "left" },
    serialNumber: {
      x: 0.82,
      y: 0.73,
      width: 0.13,
      height: 0.07,
      align: "left",
    },
    name: { x: 0.17, y: 0.6, width: 0.62, height: 0.08, align: "left" },
    father: { x: 0.17, y: 0.51, width: 0.62, height: 0.08, align: "left" },
    address: { x: 0.17, y: 0.39, width: 0.64, height: 0.11, align: "left" },
    sex: { x: 0.82, y: 0.6, width: 0.09, height: 0.08, align: "left" },
    age: { x: 0.82, y: 0.51, width: 0.09, height: 0.08, align: "left" },
    pollingStation: {
      x: 0.17,
      y: 0.24,
      width: 0.74,
      height: 0.12,
      align: "left",
    },
  },
};

const SAMPLE_VALUES = {
  partNo: "5",
  serialNumber: "1",
  name: "রিজিয়া বিবি",
  father: "গোলাম মণ্ডল",
  address: "N-0031, পুর্ব নারায়ণপুর পশ্চিমপাড়া",
  sex: "F",
  age: "54",
  pollingStation: "Narayapur S.S.K",
};

const DEFAULT_TEXT_FIT = {
  align: "left",
  maxLines: 2,
  maxFontSize: 14,
  minFontSize: 9,
  paddingX: 0,
  paddingY: 0,
};

const MIN_BOX_SIZE = 0.015;
const MIN_RECOMMENDED_WIDTH = 0.08;
const MIN_RECOMMENDED_HEIGHT = 0.035;
const ZOOM_OPTIONS = [50, 75, 100, 125, 150, "fit"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toCssBox(field) {
  return {
    left: Number(field.x || 0),
    top: Number(1 - Number(field.y || 0) - Number(field.height || 0)),
    width: Number(field.width || 0),
    height: Number(field.height || 0),
  };
}

function fromCssBox(cssBox) {
  return {
    x: cssBox.left,
    y: 1 - cssBox.top - cssBox.height,
    width: cssBox.width,
    height: cssBox.height,
  };
}

function sanitizeField(field) {
  if (!field || typeof field !== "object") return null;

  const x = Number(field.x ?? field.left ?? 0);
  const y = Number(field.y ?? field.top ?? 0);
  const width = Number(field.width ?? field.w ?? 0);
  const height = Number(field.height ?? field.h ?? 0);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const isRatio = x <= 1 && y <= 1 && width <= 1 && height <= 1;
  const normalized = {
    x: isRatio ? x : x / 100,
    y: isRatio ? y : y / 100,
    width: isRatio ? width : width / 100,
    height: isRatio ? height : height / 100,
  };

  const isValid =
    normalized.x >= 0 &&
    normalized.y >= 0 &&
    normalized.width > 0 &&
    normalized.height > 0 &&
    normalized.x <= 1 &&
    normalized.y <= 1 &&
    normalized.width <= 1 &&
    normalized.height <= 1;

  if (!isValid) return null;

  return {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
    align: String(field.align || DEFAULT_TEXT_FIT.align),
    maxLines: Number(field.maxLines ?? DEFAULT_TEXT_FIT.maxLines),
    maxFontSize: Number(field.maxFontSize ?? DEFAULT_TEXT_FIT.maxFontSize),
    minFontSize: Number(field.minFontSize ?? DEFAULT_TEXT_FIT.minFontSize),
    paddingX: Number(field.paddingX ?? DEFAULT_TEXT_FIT.paddingX),
    paddingY: Number(field.paddingY ?? DEFAULT_TEXT_FIT.paddingY),
  };
}

function normalizeCalibration(raw) {
  const layout = raw?.layout || raw || {};
  const meta = raw?.meta || layout?.meta || {};
  const fieldsRaw = layout?.fields || {};

  const normalizedFields = {};
  REQUIRED_FIELDS.forEach((key) => {
    const normalized = sanitizeField(fieldsRaw[key]);
    if (normalized) normalizedFields[key] = normalized;
  });

  const requiredFields = meta?.calibration?.requiredFields || REQUIRED_FIELDS;
  const hasCompleteRequiredFields = requiredFields.every(
    (key) => !!normalizedFields[key],
  );

  return {
    version: String(layout.version || "unknown"),
    meta: {
      source: String(meta.source || "unknown"),
      lastUpdated: meta.lastUpdated || null,
      coordinateSystem: String(
        meta.coordinateSystem || "normalized-bottom-left",
      ),
      templateFile: String(
        meta.templateFile || "storage/voterslips/layout/template.png",
      ),
      layoutFileExists: Boolean(meta.layoutFileExists),
      permissions: {
        isAdmin: meta?.permissions?.isAdmin,
        canCalibrate: meta?.permissions?.canCalibrate,
        canUseManualCalibration: meta?.permissions?.canUseManualCalibration,
      },
      calibration: {
        requiredFields,
        preferredMode: String(
          meta?.calibration?.preferredMode || meta?.preferredMode || "default",
        ),
        endpoints: {
          saveManual:
            meta?.calibration?.endpoints?.saveManual ||
            "/user/voterslips/layout/manual",
        },
      },
    },
    fields: hasCompleteRequiredFields
      ? normalizedFields
      : DEFAULT_LAYOUT.fields,
    fallbackApplied: !hasCompleteRequiredFields,
    fallbackReason: hasCompleteRequiredFields
      ? ""
      : "Using safe default layout; recalibration did not produce valid boxes.",
  };
}

function getProfilesFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.profiles)) return response.profiles;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function inferAutoLabels(response, boxes) {
  const result = {};
  const source = response?.mapping || response?.labels || response || {};

  if (Array.isArray(source)) {
    source.forEach((entry, idx) => {
      const field = String(entry?.field || entry?.label || "");
      if (!field) return;
      const boxId = String(entry?.id || entry?.boxId || boxes[idx]?.id || "");
      if (boxId) result[boxId] = field;
    });
    return result;
  }

  Object.entries(source).forEach(([field, value]) => {
    if (Array.isArray(value)) {
      value.forEach((idLike) => {
        const boxId = String(idLike || "");
        if (boxId) result[boxId] = field;
      });
      return;
    }

    if (typeof value === "string" || typeof value === "number") {
      const boxId = String(value);
      if (boxId) result[boxId] = field;
      return;
    }

    if (value && typeof value === "object") {
      const boxId = String(value.id || value.boxId || "");
      if (boxId) result[boxId] = field;
    }
  });

  return result;
}

function nextManualName() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `Manual Layout ${stamp}`;
}

function fieldsToManualBoxes(fields) {
  return REQUIRED_FIELDS.map((field) => {
    const box = sanitizeField(fields?.[field]) || DEFAULT_LAYOUT.fields[field];
    return {
      id: `${field}-${Math.random().toString(36).slice(2, 8)}`,
      label: field,
      selected: true,
      ...box,
    };
  });
}

function normalizeManualBoxesForApi(boxes) {
  return boxes.map((box) => ({
    id: box.id,
    label: box.label || "",
    x: Number(box.x),
    y: Number(box.y),
    width: Number(box.width),
    height: Number(box.height),
    align: box.align || DEFAULT_TEXT_FIT.align,
    maxLines: Number(box.maxLines ?? DEFAULT_TEXT_FIT.maxLines),
    maxFontSize: Number(box.maxFontSize ?? DEFAULT_TEXT_FIT.maxFontSize),
    minFontSize: Number(box.minFontSize ?? DEFAULT_TEXT_FIT.minFontSize),
    paddingX: Number(box.paddingX ?? DEFAULT_TEXT_FIT.paddingX),
    paddingY: Number(box.paddingY ?? DEFAULT_TEXT_FIT.paddingY),
  }));
}

function buildFieldsPayload(boxes) {
  const fields = {};
  boxes.forEach((box) => {
    if (!REQUIRED_FIELDS.includes(box.label)) return;
    fields[box.label] = {
      x: Number(box.x),
      y: Number(box.y),
      width: Number(box.width),
      height: Number(box.height),
      align: box.align || DEFAULT_TEXT_FIT.align,
      maxLines: Number(box.maxLines ?? DEFAULT_TEXT_FIT.maxLines),
      maxFontSize: Number(box.maxFontSize ?? DEFAULT_TEXT_FIT.maxFontSize),
      minFontSize: Number(box.minFontSize ?? DEFAULT_TEXT_FIT.minFontSize),
      paddingX: Number(box.paddingX ?? DEFAULT_TEXT_FIT.paddingX),
      paddingY: Number(box.paddingY ?? DEFAULT_TEXT_FIT.paddingY),
    };
  });
  return fields;
}

export default function VoterSlipCalibrationPanel() {
  const templateWrapperRef = useRef(null);
  const editorCanvasRef = useRef(null);
  const editorBaselineBoxesRef = useRef([]);
  const editorBaselineMappingRef = useRef([]);

  const [calibration, setCalibration] = useState(DEFAULT_LAYOUT);
  const [templateUrl, setTemplateUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [templateLoadError, setTemplateLoadError] = useState("");
  const [layoutReady, setLayoutReady] = useState(false);

  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [preferredMode, setPreferredMode] = useState("default");

  const [manualProfileName, setManualProfileName] = useState(nextManualName);
  const [manualBoxes, setManualBoxes] = useState(
    fieldsToManualBoxes(DEFAULT_LAYOUT.fields),
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState("");
  const [textFitField, setTextFitField] = useState(REQUIRED_FIELDS[0]);
  const [autoLabelPreview, setAutoLabelPreview] = useState(null);
  const [mappingRows, setMappingRows] = useState([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [snapToGuide, setSnapToGuide] = useState(false);
  const [showFineGrid, setShowFineGrid] = useState(false);
  const [editorZoom, setEditorZoom] = useState("fit");

  const [interaction, setInteraction] = useState(null);

  const permissionMeta = calibration.meta?.permissions || {};
  const hasPermissionFlags = [
    "isAdmin",
    "canCalibrate",
    "canUseManualCalibration",
  ].some((key) => typeof permissionMeta[key] === "boolean");

  // Search page already renders this panel for admin users only.
  // If backend does not include permission flags, keep controls enabled.
  const resolvedIsAdmin = hasPermissionFlags
    ? Boolean(permissionMeta.isAdmin)
    : true;

  const canCalibrate =
    layoutReady &&
    resolvedIsAdmin &&
    (hasPermissionFlags ? Boolean(permissionMeta.canCalibrate) : true);
  const canUseManualCalibration =
    layoutReady &&
    resolvedIsAdmin &&
    (hasPermissionFlags
      ? Boolean(permissionMeta.canUseManualCalibration)
      : true);

  const selectedBox = useMemo(
    () => manualBoxes.find((box) => box.id === selectedBoxId) || null,
    [manualBoxes, selectedBoxId],
  );

  const selectedFieldBox = useMemo(
    () => manualBoxes.find((box) => box.label === textFitField) || null,
    [manualBoxes, textFitField],
  );

  const selectedBoxMetrics = useMemo(() => {
    if (!selectedBox) return null;

    const wrapper = editorCanvasRef.current;
    const rect = wrapper?.getBoundingClientRect();
    const widthPx = rect?.width || 0;
    const heightPx = rect?.height || 0;

    const css = toCssBox(selectedBox);

    return {
      px: {
        x: Math.round(css.left * widthPx),
        y: Math.round(css.top * heightPx),
        width: Math.round(css.width * widthPx),
        height: Math.round(css.height * heightPx),
      },
      normalized: {
        x: Number(selectedBox.x || 0),
        y: Number(selectedBox.y || 0),
        width: Number(selectedBox.width || 0),
        height: Number(selectedBox.height || 0),
      },
    };
  }, [selectedBox, editorZoom, isEditorOpen]);

  const selectedBoxTooSmall = useMemo(() => {
    if (!selectedBox) return false;
    return (
      Number(selectedBox.width || 0) < MIN_RECOMMENDED_WIDTH ||
      Number(selectedBox.height || 0) < MIN_RECOMMENDED_HEIGHT
    );
  }, [selectedBox]);

  const fieldToBoxIndex = useMemo(() => {
    const acc = {};
    manualBoxes.forEach((box, index) => {
      if (box.label && !acc[box.label]) {
        acc[box.label] = index + 1;
      }
    });
    return acc;
  }, [manualBoxes]);

  const editorZoomStyle = useMemo(() => {
    if (editorZoom === "fit") {
      return { width: "100%" };
    }
    return { width: `${editorZoom}%` };
  }, [editorZoom]);

  const closeEditor = useCallback(() => {
    if (editorDirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved box changes. Discard and close editor?",
      );
      if (!shouldDiscard) return;
    }
    setIsEditorOpen(false);
  }, [editorDirty]);

  const refreshProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await adminAPI.getVoterSlipManualProfiles();
      const profileList = getProfilesFromResponse(res);
      setProfiles(profileList);
      if (!selectedProfileId && profileList[0]?.id) {
        setSelectedProfileId(String(profileList[0].id));
      }
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 403) {
        toast.error("Only admin users can access manual calibration profiles.");
      } else {
        toast.error(err?.message || "Failed to load manual profiles.");
      }
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, [selectedProfileId]);

  const loadTemplateImage = useCallback(async () => {
    setTemplateLoadError("");
    if (typeof window === "undefined") return;

    try {
      const res = await adminAPI.getVoterSlipTemplateImage();
      const objectUrl = URL.createObjectURL(res.blob);
      setTemplateUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
    } catch (err) {
      const status = Number(err?.status || 0);
      if (status === 404) {
        setTemplateLoadError(
          "Calibration template image not reachable from backend. Check /user/voterslips/layout/template.png.",
        );
        return;
      }
      setTemplateLoadError(
        err?.message ||
          "Template image could not be loaded from backend layout endpoint.",
      );
    }
  }, []);

  const loadCalibration = useCallback(async () => {
    setLoading(true);
    setError("");
    setTemplateLoadError("");

    try {
      const res = await adminAPI.getVoterSlipLayout();
      const normalized = normalizeCalibration(res);
      setCalibration(normalized);
      setPreferredMode(
        normalized.meta?.calibration?.preferredMode || "default",
      );
      setManualBoxes(fieldsToManualBoxes(normalized.fields));
      setMappingRows([]);
      setIsEditMode(false);
      setLayoutReady(true);
      await loadTemplateImage();

      if (normalized.meta?.source === "default") {
        toast(
          "Using safe default layout; recalibration did not produce valid boxes.",
          { icon: "i" },
        );
      }

      if (normalized.fallbackApplied) {
        toast(normalized.fallbackReason, { icon: "!" });
      }
    } catch (err) {
      setCalibration(DEFAULT_LAYOUT);
      setLayoutReady(false);
      const status = Number(err?.status || 0);
      if (status === 404) {
        setError(
          "Calibration API not reachable; check backend deployment and route prefix.",
        );
      } else {
        setError(
          err?.message ||
            "Calibration metadata could not be loaded. Retry to enable calibration actions.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [loadTemplateImage]);

  useEffect(() => {
    loadCalibration();
  }, [loadCalibration]);

  useEffect(() => {
    if (canUseManualCalibration) {
      refreshProfiles();
    }
  }, [canUseManualCalibration, refreshProfiles]);

  useEffect(
    () => () => {
      setTemplateUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    },
    [],
  );

  useEffect(() => {
    if (!isEditorOpen) return;

    editorBaselineBoxesRef.current = manualBoxes.map((box) => ({ ...box }));
    editorBaselineMappingRef.current = mappingRows.map((row) => ({ ...row }));
    setEditorDirty(false);
  }, [isEditorOpen]);

  useEffect(() => {
    if (!isEditorOpen) return;
    const baseline = JSON.stringify(editorBaselineBoxesRef.current);
    const current = JSON.stringify(manualBoxes);
    setEditorDirty(baseline !== current);
  }, [manualBoxes, isEditorOpen]);

  useEffect(() => {
    if (!interaction) return;

    const activeWrapper =
      interaction.surface === "editor"
        ? editorCanvasRef.current
        : templateWrapperRef.current;

    const handleMouseMove = (event) => {
      const wrapper = activeWrapper;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const dxNorm = (event.clientX - interaction.startX) / rect.width;
      const dyNorm = (event.clientY - interaction.startY) / rect.height;

      setManualBoxes((prev) =>
        prev.map((box) => {
          if (box.id !== interaction.boxId) return box;

          const cssStart = toCssBox(interaction.startBox);
          let cssNext = { ...cssStart };

          if (interaction.type === "move") {
            cssNext.left = clamp(cssStart.left + dxNorm, 0, 1 - cssStart.width);
            cssNext.top = clamp(cssStart.top + dyNorm, 0, 1 - cssStart.height);
          } else if (interaction.type === "resize") {
            const corner = interaction.corner || "se";
            if (corner === "se") {
              cssNext.width = clamp(
                cssStart.width + dxNorm,
                MIN_BOX_SIZE,
                1 - cssStart.left,
              );
              cssNext.height = clamp(
                cssStart.height + dyNorm,
                MIN_BOX_SIZE,
                1 - cssStart.top,
              );
            } else if (corner === "sw") {
              const nextLeft = clamp(
                cssStart.left + dxNorm,
                0,
                cssStart.left + cssStart.width - MIN_BOX_SIZE,
              );
              cssNext.left = nextLeft;
              cssNext.width = clamp(
                cssStart.width - (nextLeft - cssStart.left),
                MIN_BOX_SIZE,
                1 - nextLeft,
              );
              cssNext.height = clamp(
                cssStart.height + dyNorm,
                MIN_BOX_SIZE,
                1 - cssStart.top,
              );
            } else if (corner === "ne") {
              const nextTop = clamp(
                cssStart.top + dyNorm,
                0,
                cssStart.top + cssStart.height - MIN_BOX_SIZE,
              );
              cssNext.top = nextTop;
              cssNext.height = clamp(
                cssStart.height - (nextTop - cssStart.top),
                MIN_BOX_SIZE,
                1 - nextTop,
              );
              cssNext.width = clamp(
                cssStart.width + dxNorm,
                MIN_BOX_SIZE,
                1 - cssStart.left,
              );
            } else {
              const nextLeft = clamp(
                cssStart.left + dxNorm,
                0,
                cssStart.left + cssStart.width - MIN_BOX_SIZE,
              );
              const nextTop = clamp(
                cssStart.top + dyNorm,
                0,
                cssStart.top + cssStart.height - MIN_BOX_SIZE,
              );
              cssNext.left = nextLeft;
              cssNext.top = nextTop;
              cssNext.width = clamp(
                cssStart.width - (nextLeft - cssStart.left),
                MIN_BOX_SIZE,
                1 - nextLeft,
              );
              cssNext.height = clamp(
                cssStart.height - (nextTop - cssStart.top),
                MIN_BOX_SIZE,
                1 - nextTop,
              );
            }
          }

          if (snapToGuide && interaction.surface === "editor") {
            const snapStep = 0.0025;
            cssNext.left = Math.round(cssNext.left / snapStep) * snapStep;
            cssNext.top = Math.round(cssNext.top / snapStep) * snapStep;
            cssNext.width = Math.round(cssNext.width / snapStep) * snapStep;
            cssNext.height = Math.round(cssNext.height / snapStep) * snapStep;

            cssNext.left = clamp(cssNext.left, 0, 1 - MIN_BOX_SIZE);
            cssNext.top = clamp(cssNext.top, 0, 1 - MIN_BOX_SIZE);
            cssNext.width = clamp(
              cssNext.width,
              MIN_BOX_SIZE,
              1 - cssNext.left,
            );
            cssNext.height = clamp(
              cssNext.height,
              MIN_BOX_SIZE,
              1 - cssNext.top,
            );
          }

          const normalized = fromCssBox(cssNext);
          return {
            ...box,
            x: normalized.x,
            y: normalized.y,
            width: normalized.width,
            height: normalized.height,
          };
        }),
      );
    };

    const handleMouseUp = () => setInteraction(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [interaction]);

  useEffect(() => {
    if (!isEditorOpen || !isEditMode) return;

    const handleKeyDown = (event) => {
      if (!selectedBoxId) return;
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        if (event.key === "Escape") {
          closeEditor();
        }
        return;
      }

      const wrapper = editorCanvasRef.current;
      const rect = wrapper?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;

      event.preventDefault();

      const stepPx = event.shiftKey ? 5 : 1;
      const dxNorm = stepPx / rect.width;
      const dyNorm = stepPx / rect.height;

      setManualBoxes((prev) =>
        prev.map((box) => {
          if (box.id !== selectedBoxId) return box;

          const css = toCssBox(box);
          let next = { ...css };

          const isAltResize = event.altKey;

          if (!isAltResize) {
            if (event.key === "ArrowLeft") {
              next.left = clamp(css.left - dxNorm, 0, 1 - css.width);
            }
            if (event.key === "ArrowRight") {
              next.left = clamp(css.left + dxNorm, 0, 1 - css.width);
            }
            if (event.key === "ArrowUp") {
              next.top = clamp(css.top - dyNorm, 0, 1 - css.height);
            }
            if (event.key === "ArrowDown") {
              next.top = clamp(css.top + dyNorm, 0, 1 - css.height);
            }
          } else {
            if (event.key === "ArrowLeft") {
              next.width = clamp(
                css.width - dxNorm,
                MIN_BOX_SIZE,
                1 - css.left,
              );
            }
            if (event.key === "ArrowRight") {
              next.width = clamp(
                css.width + dxNorm,
                MIN_BOX_SIZE,
                1 - css.left,
              );
            }
            if (event.key === "ArrowUp") {
              next.height = clamp(
                css.height - dyNorm,
                MIN_BOX_SIZE,
                1 - css.top,
              );
            }
            if (event.key === "ArrowDown") {
              next.height = clamp(
                css.height + dyNorm,
                MIN_BOX_SIZE,
                1 - css.top,
              );
            }
          }

          if (snapToGuide) {
            const snapStep = 0.0025;
            next.left = Math.round(next.left / snapStep) * snapStep;
            next.top = Math.round(next.top / snapStep) * snapStep;
            next.width = Math.round(next.width / snapStep) * snapStep;
            next.height = Math.round(next.height / snapStep) * snapStep;
            next.left = clamp(next.left, 0, 1 - MIN_BOX_SIZE);
            next.top = clamp(next.top, 0, 1 - MIN_BOX_SIZE);
            next.width = clamp(next.width, MIN_BOX_SIZE, 1 - next.left);
            next.height = clamp(next.height, MIN_BOX_SIZE, 1 - next.top);
          }

          const normalized = fromCssBox(next);
          return {
            ...box,
            x: normalized.x,
            y: normalized.y,
            width: normalized.width,
            height: normalized.height,
          };
        }),
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorOpen, isEditMode, selectedBoxId, snapToGuide, closeEditor]);

  const handleStartInteraction = (
    event,
    box,
    type,
    surface = "panel",
    corner,
  ) => {
    if (!isEditMode) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedBoxId(box.id);
    setInteraction({
      type,
      boxId: box.id,
      startX: event.clientX,
      startY: event.clientY,
      startBox: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      surface,
      corner,
    });
  };

  const handleRecalibrate = async () => {
    setBusyAction("recalibrate");
    setError("");
    try {
      await adminAPI.recalibrateVoterSlipLayout();
      toast.success("Recalibration finished. Reloading latest layout...");
      await loadCalibration();
      if (canUseManualCalibration) {
        await refreshProfiles();
      }
    } catch (err) {
      const status = Number(err?.status || 0);
      const message =
        status === 403
          ? "Only admin users can recalibrate or reset voter slip layout."
          : err?.message || "Recalibration failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  };

  const handleRevert = async () => {
    setBusyAction("revert");
    setError("");
    try {
      await adminAPI.resetVoterSlipLayoutToDefault();
      toast.success("Reverted to default layout. Reloading...");
      await loadCalibration();
      if (canUseManualCalibration) {
        await refreshProfiles();
      }
    } catch (err) {
      const status = Number(err?.status || 0);
      const message =
        status === 403
          ? "Only admin users can recalibrate or reset voter slip layout."
          : err?.message || "Could not revert to default layout";
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  };

  const handleModeSave = async () => {
    setBusyAction("mode");
    try {
      await adminAPI.setVoterSlipLayoutMode(preferredMode);
      toast.success(`Preferred mode saved: ${preferredMode}`);
      await loadCalibration();
    } catch (err) {
      const status = Number(err?.status || 0);
      const message =
        status === 403
          ? "Only admin users can change preferred layout mode."
          : err?.message || "Could not save preferred mode.";
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  };

  const handleAddBox = () => {
    if (!isEditMode) return;
    const box = {
      id: `manual-${Math.random().toString(36).slice(2, 8)}`,
      label: "",
      selected: true,
      x: 0.2,
      y: 0.2,
      width: 0.2,
      height: 0.08,
      ...DEFAULT_TEXT_FIT,
    };
    setManualBoxes((prev) => [...prev, box]);
    setSelectedBoxId(box.id);
  };

  const handleDeleteSelectedBox = () => {
    if (!isEditMode) return;
    if (!selectedBoxId) return;
    setManualBoxes((prev) => prev.filter((box) => box.id !== selectedBoxId));
    setSelectedBoxId("");
  };

  const updateSelectedBox = (patch) => {
    if (!isEditMode) return;
    if (!selectedBoxId) return;
    setManualBoxes((prev) =>
      prev.map((box) => {
        if (box.id !== selectedBoxId) return box;
        return { ...box, ...patch };
      }),
    );
  };

  const handleAutoLabels = async () => {
    if (!isEditMode) {
      toast.error("Enable Edit Mode to auto-label selected boxes.");
      return;
    }

    const selectedBoxes = manualBoxes.filter((box) => box.selected);
    if (!selectedBoxes.length) {
      toast.error("Select at least one box for auto-labeling.");
      return;
    }

    setBusyAction("auto-label");
    setAutoLabelPreview(null);

    try {
      const payloadBoxes = normalizeBoxesForApi(
        selectedBoxes,
        DEFAULT_TEXT_FIT,
      );
      const res = await adminAPI.autoLabelVoterSlipBoxes(payloadBoxes);
      const rows = inferAutoLabelRows(res, selectedBoxes);

      const mapped = {};
      rows.forEach((row) => {
        if (row?.boxId && row?.field) {
          mapped[String(row.boxId)] = String(row.field);
        }
      });

      if (!Object.keys(mapped).length) {
        toast("No labels detected. You can set labels manually.", {
          icon: "i",
        });
      }

      setMappingRows(rows);
      setAutoLabelPreview(mapped);
      setManualBoxes((prev) => applyMappingRowsToBoxes(prev, rows));
      toast.success("Auto-label preview updated.");
    } catch (err) {
      const status = Number(err?.status || 0);
      const message =
        status === 403
          ? "Only admin users can use auto-labeling for manual calibration."
          : err?.message || "Auto-labeling failed.";
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  };

  const handleMappingFieldChange = (rowId, field) => {
    if (!isEditMode) return;
    setMappingRows((prev) => {
      const next = prev.map((row) =>
        row.id === rowId ? { ...row, field, source: "manual" } : row,
      );
      setManualBoxes((boxes) => applyMappingRowsToBoxes(boxes, next));
      return next;
    });
  };

  const handleMappingBoxChange = (rowId, boxId) => {
    if (!isEditMode) return;
    setMappingRows((prev) => {
      const targetBox = manualBoxes.find((box) => String(box.id) === boxId);
      const next = prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              boxId,
              boxIndex: targetBox
                ? manualBoxes.findIndex((box) => box.id === targetBox.id) + 1
                : row.boxIndex,
              source: "manual",
            }
          : row,
      );
      setManualBoxes((boxes) => applyMappingRowsToBoxes(boxes, next));
      return next;
    });
  };

  const updateTextFitField = (field, patch) => {
    if (!isEditMode) return;
    setManualBoxes((prev) =>
      prev.map((box) =>
        box.label === field
          ? {
              ...box,
              ...patch,
            }
          : box,
      ),
    );
  };

  const handleSaveManualProfile = async ({ closeOnSuccess = false } = {}) => {
    if (!isEditMode) {
      toast.error("Enable Edit Mode before saving a manual profile.");
      return;
    }

    const normalizedBoxes = normalizeBoxesForApi(manualBoxes, DEFAULT_TEXT_FIT);

    const rowsToValidate =
      mappingRows.length > 0
        ? mappingRows
        : normalizedBoxes
            .filter((box) => box.label)
            .map((box, idx) => ({
              id: `map-${box.id}`,
              field: box.label,
              boxId: box.id,
              boxIndex: idx + 1,
              source: "manual",
              confidence: null,
            }));

    const validation = validateUniqueFieldAssignments(
      rowsToValidate,
      REQUIRED_FIELDS,
    );

    if (!validation.valid) {
      toast.error(validation.reason || "Invalid field mapping.");
      return;
    }

    const fields = buildFieldsPayloadFromBoxes(
      normalizedBoxes,
      REQUIRED_FIELDS,
    );

    const payload = {
      name: manualProfileName || nextManualName(),
      activate: true,
      setPreferred: true,
      boxes: normalizedBoxes,
    };

    if (Object.keys(fields).length) {
      payload.fields = fields;
    }

    setBusyAction("save-manual");
    try {
      const res = await adminAPI.saveVoterSlipManualLayout(payload);
      const profileId = String(
        res?.profile?.id || res?.id || res?.profileId || "",
      );
      if (profileId) {
        setSelectedProfileId(profileId);
      }
      toast.success("Manual profile saved and activated.");
      await loadCalibration();
      await refreshProfiles();
      if (closeOnSuccess) {
        setIsEditorOpen(false);
      }
    } catch (err) {
      const status = Number(err?.status || 0);
      const message =
        status === 403
          ? "Only admin users can save manual calibration profiles."
          : err?.message || "Could not save manual profile.";
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  };

  const handleResetSelectedBox = () => {
    if (!selectedBoxId) return;
    const baseline = editorBaselineBoxesRef.current.find(
      (box) => box.id === selectedBoxId,
    );

    if (!baseline) {
      setManualBoxes((prev) => prev.filter((box) => box.id !== selectedBoxId));
      setSelectedBoxId("");
      return;
    }

    setManualBoxes((prev) =>
      prev.map((box) => (box.id === selectedBoxId ? { ...baseline } : box)),
    );
  };

  const handleResetAllUnsaved = () => {
    setManualBoxes(editorBaselineBoxesRef.current.map((box) => ({ ...box })));
    setMappingRows(editorBaselineMappingRef.current.map((row) => ({ ...row })));
  };

  const handleApplyProfile = async () => {
    if (!selectedProfileId) {
      toast.error("Select a profile first.");
      return;
    }

    setBusyAction("apply-profile");
    try {
      await adminAPI.applyVoterSlipManualProfile(selectedProfileId, {
        setPreferred: true,
      });
      toast.success("Manual profile applied.");
      await loadCalibration();
      await refreshProfiles();
    } catch (err) {
      const status = Number(err?.status || 0);
      const message =
        status === 403
          ? "Only admin users can apply manual calibration profiles."
          : err?.message || "Could not apply selected profile.";
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  };

  const fieldEntries = useMemo(
    () =>
      REQUIRED_FIELDS.map((key) => ({
        key,
        box: calibration.fields?.[key] || DEFAULT_LAYOUT.fields[key],
      })),
    [calibration.fields],
  );

  const mappingValidation = useMemo(
    () => validateUniqueFieldAssignments(mappingRows, REQUIRED_FIELDS),
    [mappingRows],
  );

  const overlayBoxes =
    canUseManualCalibration && isEditMode ? manualBoxes : fieldEntries;

  return (
    <div className="card space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            Voter Slip Position Calibration
          </h3>
          <p className="text-sm text-slate-300">
            Verify field boxes against backend template and keep alignment
            stable.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Layout Version: {calibration.version || "unknown"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Source: {calibration.meta?.source || "unknown"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Last Updated: {calibration.meta?.lastUpdated || "Not available"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Coordinate System: {calibration.meta?.coordinateSystem || "unknown"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Preferred Mode:{" "}
            {calibration.meta?.calibration?.preferredMode || "default"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRecalibrate}
            disabled={busyAction === "recalibrate" || loading || !canCalibrate}
          >
            {busyAction === "recalibrate"
              ? "Recalibrating..."
              : "Recalibrate with Gemini OCR"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRevert}
            disabled={busyAction === "revert" || loading || !canCalibrate}
          >
            {busyAction === "revert" ? "Reverting..." : "Revert to Default"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadCalibration}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Layout"}
          </button>
          {canUseManualCalibration && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditMode((prev) => !prev)}
            >
              {isEditMode ? "Exit Edit Mode" : "Edit Mode"}
            </button>
          )}
          {canUseManualCalibration && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditorOpen(true)}
              disabled={!isEditMode}
            >
              Open Box Editor
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-amber-700 bg-amber-900/40 text-amber-100 text-sm">
          {error}
        </div>
      )}

      {!layoutReady && (
        <div className="p-3 rounded-lg border border-amber-700 bg-amber-900/40 text-amber-100 text-sm">
          Calibration API unavailable. Calibration actions are disabled until
          layout metadata is loaded.
        </div>
      )}

      {layoutReady && calibration.meta?.source === "default" && (
        <div className="p-3 rounded-lg border border-sky-700 bg-sky-900/30 text-sky-100 text-sm">
          Using safe default layout; recalibration did not produce valid boxes.
        </div>
      )}

      {calibration.fallbackApplied && (
        <div className="p-3 rounded-lg border border-amber-700 bg-amber-900/40 text-amber-100 text-sm">
          {calibration.fallbackReason}
        </div>
      )}

      {templateLoadError && (
        <div className="p-3 rounded-lg border border-amber-700 bg-amber-900/40 text-amber-100 text-sm">
          {templateLoadError}
        </div>
      )}

      {canCalibrate && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border border-ink-400/40 bg-ink-900/40 p-3">
          <div className="md:col-span-2">
            <label htmlFor="preferredMode">Preferred Calibration Mode</label>
            <select
              id="preferredMode"
              value={preferredMode}
              onChange={(e) => setPreferredMode(e.target.value)}
            >
              <option value="default">default</option>
              <option value="gemini">gemini</option>
              <option value="manual">manual</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={handleModeSave}
              disabled={busyAction === "mode"}
            >
              {busyAction === "mode" ? "Saving..." : "Save Mode"}
            </button>
          </div>
          <div className="flex items-end text-xs text-slate-400">
            Manual mode remains active after saving a manual profile.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <div
            ref={templateWrapperRef}
            className="relative w-full bg-slate-100 rounded-lg overflow-hidden border border-ink-400/40"
          >
            <img
              src={
                templateUrl ||
                "/templates/sabyasachi_dutta_voterslip_format.png"
              }
              alt="Voter slip template"
              className="w-full h-auto block"
              onError={() => {
                setTemplateLoadError(
                  "Template image could not be loaded. Verify backend template endpoint and deployment.",
                );
              }}
            />
            {overlayBoxes.map((entry) => {
              const isEditable = canUseManualCalibration && isEditMode;
              const key = isEditable ? entry.id : entry.key;
              const label = isEditable ? entry.label || "unlabeled" : entry.key;
              const field = isEditable ? entry : entry.box;
              const isSelected = isEditable && selectedBoxId === entry.id;
              const boxIndex = isEditable
                ? manualBoxes.findIndex((box) => box.id === entry.id) + 1
                : null;

              return (
                <div
                  key={`overlay-${key}`}
                  className={`absolute border ${isSelected ? "border-blue-500 bg-blue-500/15" : "border-emerald-500 bg-emerald-500/10"}`}
                  style={{
                    left: `${field.x * 100}%`,
                    top: `${(1 - field.y - field.height) * 100}%`,
                    width: `${field.width * 100}%`,
                    height: `${field.height * 100}%`,
                    cursor: isEditable ? "move" : "default",
                  }}
                  title={label}
                  onMouseDown={(event) => {
                    if (!isEditable) return;
                    handleStartInteraction(event, entry, "move", "panel");
                  }}
                  onClick={() => {
                    if (isEditable) {
                      setSelectedBoxId(entry.id);
                    }
                  }}
                >
                  <div className="text-[10px] text-emerald-950 bg-emerald-300/85 px-1 w-fit">
                    {isEditable ? `#${boxIndex} ${label}` : label}
                  </div>
                  <div className="text-[11px] text-slate-900 px-1 truncate">
                    {SAMPLE_VALUES[label] || "Sample"}
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      className="absolute right-0 bottom-0 w-3 h-3 bg-blue-500 border border-blue-300"
                      onMouseDown={(event) =>
                        handleStartInteraction(
                          event,
                          entry,
                          "resize",
                          "panel",
                          "se",
                        )
                      }
                      aria-label="Resize box"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-base font-semibold text-slate-100">
            Field Boxes (Read-only)
          </h4>
          <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
            {fieldEntries.map(({ key, box }) => (
              <div
                key={`field-${key}`}
                className="rounded-md border border-ink-400/40 bg-ink-900/40 p-2 text-xs text-slate-200"
              >
                <div className="font-semibold text-slate-100">
                  {FIELD_LABELS[key] || key}
                </div>
                <div>
                  x: {(box.x * 100).toFixed(2)}%, y: {(box.y * 100).toFixed(2)}%
                </div>
                <div>
                  w: {(box.width * 100).toFixed(2)}%, h:{" "}
                  {(box.height * 100).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {canUseManualCalibration && (
        <div className="space-y-4 rounded-lg border border-ink-400/40 bg-ink-900/40 p-4">
          {!isEditMode && (
            <div className="rounded-md border border-ink-400/40 bg-ink-800/50 p-3 text-xs text-slate-300">
              Enable Edit Mode to add, drag, resize, auto-label, and save manual
              profile changes.
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label htmlFor="manualProfileName">Manual Profile Name</label>
              <input
                id="manualProfileName"
                type="text"
                value={manualProfileName}
                onChange={(e) => setManualProfileName(e.target.value)}
                placeholder="Manual profile name"
                disabled={!isEditMode}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddBox}
              disabled={!isEditMode}
            >
              Add Box
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDeleteSelectedBox}
              disabled={!isEditMode || !selectedBox}
            >
              Delete Selected
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditorOpen(true)}
              disabled={!isEditMode}
            >
              Open Box Editor
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAutoLabels}
              disabled={!isEditMode || busyAction === "auto-label"}
            >
              {busyAction === "auto-label"
                ? "Labeling..."
                : "Auto-label Selected Boxes"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveManualProfile}
              disabled={!isEditMode || busyAction === "save-manual"}
            >
              {busyAction === "save-manual"
                ? "Saving..."
                : "Save Manual Profile"}
            </button>
          </div>

          {autoLabelPreview && (
            <div className="rounded-md border border-sky-700 bg-sky-900/30 p-3 text-xs text-sky-100">
              Auto-label preview applied. Review labels before saving.
            </div>
          )}

          {mappingRows.length > 0 && (
            <div className="rounded-md border border-ink-400/40 bg-ink-800/40 p-3">
              <h5 className="text-sm font-semibold text-slate-100 mb-2">
                Mapping Review
              </h5>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-300 border-b border-ink-500/40">
                      <th className="py-2 pr-2 text-left">Field</th>
                      <th className="py-2 pr-2 text-left">Box Index</th>
                      <th className="py-2 pr-2 text-left">Source</th>
                      <th className="py-2 pr-2 text-left">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingRows.map((row) => (
                      <tr key={row.id} className="border-b border-ink-500/20">
                        <td className="py-2 pr-2">
                          <select
                            value={row.field || ""}
                            onChange={(e) =>
                              handleMappingFieldChange(row.id, e.target.value)
                            }
                            disabled={!isEditMode}
                          >
                            <option value="">Unmapped</option>
                            {REQUIRED_FIELDS.map((field) => (
                              <option
                                key={`map-field-${row.id}-${field}`}
                                value={field}
                              >
                                {FIELD_LABELS[field] || field}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={String(row.boxId || "")}
                            onChange={(e) =>
                              handleMappingBoxChange(row.id, e.target.value)
                            }
                            disabled={!isEditMode}
                          >
                            {manualBoxes.map((box, idx) => (
                              <option
                                key={`map-box-${row.id}-${box.id}`}
                                value={String(box.id)}
                              >
                                {`#${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2 text-slate-300">
                          {row.source || "auto"}
                        </td>
                        <td className="py-2 pr-2 text-slate-300">
                          {row.confidence ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!mappingValidation.valid && (
                <p className="mt-2 text-xs text-amber-300">
                  {mappingValidation.reason}
                </p>
              )}
            </div>
          )}

          <div className="rounded-md border border-ink-400/40 bg-ink-800/40 p-3 space-y-3">
            <h5 className="text-sm font-semibold text-slate-100">
              Text Fit By Field
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label htmlFor="textFitField">Field</label>
                <select
                  id="textFitField"
                  value={textFitField}
                  onChange={(e) => setTextFitField(e.target.value)}
                >
                  {REQUIRED_FIELDS.map((field) => (
                    <option key={`text-fit-${field}`} value={field}>
                      {FIELD_LABELS[field] || field}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="textFitAlign">align</label>
                <select
                  id="textFitAlign"
                  disabled={!isEditMode || !selectedFieldBox}
                  value={selectedFieldBox?.align || "left"}
                  onChange={(e) =>
                    updateTextFitField(textFitField, { align: e.target.value })
                  }
                >
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </div>
              <div className="text-xs text-slate-400 flex items-end">
                {selectedFieldBox
                  ? "Editing mapped field text-fit settings."
                  : "No box mapped to this field yet."}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <div>
                <label htmlFor="fieldMaxLines">maxLines</label>
                <input
                  id="fieldMaxLines"
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  disabled={!isEditMode || !selectedFieldBox}
                  value={
                    selectedFieldBox?.maxLines ?? DEFAULT_TEXT_FIT.maxLines
                  }
                  onChange={(e) =>
                    updateTextFitField(textFitField, {
                      maxLines: Number(e.target.value || 1),
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="fieldMaxFontSize">maxFontSize</label>
                <input
                  id="fieldMaxFontSize"
                  type="number"
                  min="6"
                  max="40"
                  step="1"
                  disabled={!isEditMode || !selectedFieldBox}
                  value={
                    selectedFieldBox?.maxFontSize ??
                    DEFAULT_TEXT_FIT.maxFontSize
                  }
                  onChange={(e) =>
                    updateTextFitField(textFitField, {
                      maxFontSize: Number(e.target.value || 12),
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="fieldMinFontSize">minFontSize</label>
                <input
                  id="fieldMinFontSize"
                  type="number"
                  min="4"
                  max="30"
                  step="1"
                  disabled={!isEditMode || !selectedFieldBox}
                  value={
                    selectedFieldBox?.minFontSize ??
                    DEFAULT_TEXT_FIT.minFontSize
                  }
                  onChange={(e) =>
                    updateTextFitField(textFitField, {
                      minFontSize: Number(e.target.value || 8),
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="fieldPaddingX">paddingX</label>
                <input
                  id="fieldPaddingX"
                  type="number"
                  step="0.5"
                  disabled={!isEditMode || !selectedFieldBox}
                  value={
                    selectedFieldBox?.paddingX ?? DEFAULT_TEXT_FIT.paddingX
                  }
                  onChange={(e) =>
                    updateTextFitField(textFitField, {
                      paddingX: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="fieldPaddingY">paddingY</label>
                <input
                  id="fieldPaddingY"
                  type="number"
                  step="0.5"
                  disabled={!isEditMode || !selectedFieldBox}
                  value={
                    selectedFieldBox?.paddingY ?? DEFAULT_TEXT_FIT.paddingY
                  }
                  onChange={(e) =>
                    updateTextFitField(textFitField, {
                      paddingY: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
              {manualBoxes.map((box) => {
                const isSelected = selectedBoxId === box.id;
                return (
                  <button
                    key={`manual-box-${box.id}`}
                    type="button"
                    className={`w-full text-left rounded-md border p-2 ${isSelected ? "border-blue-500 bg-blue-900/20" : "border-ink-400/40 bg-ink-800/40"}`}
                    onClick={() => setSelectedBoxId(box.id)}
                    disabled={!isEditMode}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-200 font-semibold">
                        {box.label || "unlabeled"}
                      </span>
                      <label className="text-[11px] text-slate-300 flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!box.selected}
                          disabled={!isEditMode}
                          onChange={(e) => {
                            e.stopPropagation();
                            setManualBoxes((prev) =>
                              prev.map((item) =>
                                item.id === box.id
                                  ? { ...item, selected: e.target.checked }
                                  : item,
                              ),
                            );
                          }}
                        />
                        selected
                      </label>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      x {(box.x * 100).toFixed(1)}% y {(box.y * 100).toFixed(1)}
                      % w {(box.width * 100).toFixed(1)}% h{" "}
                      {(box.height * 100).toFixed(1)}%
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {selectedBox ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="boxLabel">Field Label</label>
                      <select
                        id="boxLabel"
                        value={selectedBox.label || ""}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          updateSelectedBox({ label: e.target.value })
                        }
                      >
                        <option value="">Unlabeled</option>
                        {REQUIRED_FIELDS.map((field) => (
                          <option key={`label-${field}`} value={field}>
                            {FIELD_LABELS[field] || field}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="boxAlign">Align</label>
                      <select
                        id="boxAlign"
                        value={selectedBox.align || "left"}
                        disabled={!isEditMode}
                        onChange={(e) =>
                          updateSelectedBox({ align: e.target.value })
                        }
                      >
                        <option value="left">left</option>
                        <option value="center">center</option>
                        <option value="right">right</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="boxX">x</label>
                      <input
                        id="boxX"
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={selectedBox.x}
                        onChange={(e) =>
                          updateSelectedBox({
                            x: clamp(Number(e.target.value || 0), 0, 1),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxY">y</label>
                      <input
                        id="boxY"
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={selectedBox.y}
                        onChange={(e) =>
                          updateSelectedBox({
                            y: clamp(Number(e.target.value || 0), 0, 1),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxWidth">width</label>
                      <input
                        id="boxWidth"
                        type="number"
                        min="0.01"
                        max="1"
                        step="0.001"
                        value={selectedBox.width}
                        onChange={(e) =>
                          updateSelectedBox({
                            width: clamp(
                              Number(e.target.value || MIN_BOX_SIZE),
                              MIN_BOX_SIZE,
                              1,
                            ),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxHeight">height</label>
                      <input
                        id="boxHeight"
                        type="number"
                        min="0.01"
                        max="1"
                        step="0.001"
                        value={selectedBox.height}
                        onChange={(e) =>
                          updateSelectedBox({
                            height: clamp(
                              Number(e.target.value || MIN_BOX_SIZE),
                              MIN_BOX_SIZE,
                              1,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="boxMaxLines">maxLines</label>
                      <input
                        id="boxMaxLines"
                        type="number"
                        min="1"
                        max="8"
                        step="1"
                        value={
                          selectedBox.maxLines ?? DEFAULT_TEXT_FIT.maxLines
                        }
                        onChange={(e) =>
                          updateSelectedBox({
                            maxLines: Number(e.target.value || 1),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxMaxFontSize">maxFontSize</label>
                      <input
                        id="boxMaxFontSize"
                        type="number"
                        min="6"
                        max="40"
                        step="1"
                        value={
                          selectedBox.maxFontSize ??
                          DEFAULT_TEXT_FIT.maxFontSize
                        }
                        onChange={(e) =>
                          updateSelectedBox({
                            maxFontSize: Number(e.target.value || 12),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxMinFontSize">minFontSize</label>
                      <input
                        id="boxMinFontSize"
                        type="number"
                        min="4"
                        max="30"
                        step="1"
                        value={
                          selectedBox.minFontSize ??
                          DEFAULT_TEXT_FIT.minFontSize
                        }
                        onChange={(e) =>
                          updateSelectedBox({
                            minFontSize: Number(e.target.value || 8),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxPaddingX">paddingX</label>
                      <input
                        id="boxPaddingX"
                        type="number"
                        step="0.5"
                        value={
                          selectedBox.paddingX ?? DEFAULT_TEXT_FIT.paddingX
                        }
                        onChange={(e) =>
                          updateSelectedBox({
                            paddingX: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="boxPaddingY">paddingY</label>
                      <input
                        id="boxPaddingY"
                        type="number"
                        step="0.5"
                        value={
                          selectedBox.paddingY ?? DEFAULT_TEXT_FIT.paddingY
                        }
                        onChange={(e) =>
                          updateSelectedBox({
                            paddingY: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-400">
                  Select a box to edit coordinates and text-fit settings.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="manualProfileList">Saved Manual Profiles</label>
              <select
                id="manualProfileList"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                disabled={loadingProfiles}
              >
                <option value="">
                  {loadingProfiles ? "Loading profiles..." : "Select profile"}
                </option>
                {profiles.map((profile) => {
                  const id = String(profile?.id || profile?.profileId || "");
                  if (!id) return null;
                  const name = profile?.name || `Profile ${id}`;
                  return (
                    <option key={`profile-${id}`} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handleApplyProfile}
                disabled={busyAction === "apply-profile" || !selectedProfileId}
              >
                {busyAction === "apply-profile"
                  ? "Applying..."
                  : "Apply Selected Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && canUseManualCalibration && (
        <div className="fixed inset-0 z-[80] bg-black/70 p-3 md:p-6">
          <div className="mx-auto h-[85vh] w-[85vw] max-w-[1600px] rounded-xl border border-ink-400/50 bg-ink-950 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-ink-500/40 px-4 py-3">
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  Voter Slip Box Editor
                </h4>
                <p className="text-xs text-slate-400">
                  Arrow: move 1px, Shift+Arrow: move 5px, Alt+Arrow: resize 1px
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-300 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={snapToGuide}
                    onChange={(e) => setSnapToGuide(e.target.checked)}
                  />
                  Snap to OCR/guide
                </label>
                <label className="text-xs text-slate-300 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={showFineGrid}
                    onChange={(e) => setShowFineGrid(e.target.checked)}
                  />
                  Fine grid
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditor}
                >
                  Close Editor
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 md:p-4">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-full">
                <aside className="xl:col-span-3 rounded-lg border border-ink-400/40 bg-ink-900/50 p-3 space-y-3 overflow-auto">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-100">
                      Fields
                    </h5>
                    <div className="mt-2 space-y-1 max-h-[220px] overflow-auto pr-1">
                      {REQUIRED_FIELDS.map((field) => {
                        const boxIndex = fieldToBoxIndex[field];
                        const mappedBox = manualBoxes.find(
                          (box) => box.label === field,
                        );
                        return (
                          <button
                            key={`field-pick-${field}`}
                            type="button"
                            className={`w-full text-left rounded-md border px-2 py-1.5 text-xs ${textFitField === field ? "border-blue-500 bg-blue-900/30 text-blue-100" : "border-ink-500/40 text-slate-200"}`}
                            onClick={() => {
                              setTextFitField(field);
                              if (mappedBox?.id) setSelectedBoxId(mappedBox.id);
                            }}
                          >
                            <div className="font-semibold">
                              {FIELD_LABELS[field] || field}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {boxIndex ? `Mapped to #${boxIndex}` : "Unmapped"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="editorProfileName">Profile Name</label>
                    <input
                      id="editorProfileName"
                      type="text"
                      value={manualProfileName}
                      onChange={(e) => setManualProfileName(e.target.value)}
                      disabled={!isEditMode}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddBox}
                      disabled={!isEditMode}
                    >
                      Add Box
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleDeleteSelectedBox}
                      disabled={!isEditMode || !selectedBox}
                    >
                      Delete Box
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleResetSelectedBox}
                      disabled={!selectedBox}
                    >
                      Reset Selected Box
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleResetAllUnsaved}
                    >
                      Reset All Unsaved
                    </button>
                  </div>

                  <div className="rounded-md border border-ink-500/40 bg-ink-800/40 p-2 text-xs text-slate-300">
                    {selectedBoxTooSmall
                      ? "Selected box is smaller than recommended text area size. Increase width or height for better rendering."
                      : "Box size is within recommended range for Bengali text rendering."}
                  </div>
                </aside>

                <section className="xl:col-span-6 rounded-lg border border-ink-400/40 bg-ink-900/50 p-3 flex flex-col gap-3 min-h-[520px]">
                  <div className="flex flex-wrap gap-2">
                    {ZOOM_OPTIONS.map((item) => {
                      const key = String(item);
                      const active = editorZoom === item;
                      return (
                        <button
                          key={`zoom-${key}`}
                          type="button"
                          className={`btn ${active ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => setEditorZoom(item)}
                        >
                          {typeof item === "number" ? `${item}%` : "Fit"}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative overflow-auto rounded-md border border-ink-500/40 bg-slate-100/95 p-3 flex-1">
                    <div className="mx-auto" style={editorZoomStyle}>
                      <div className="mb-2 flex items-center gap-2">
                        {Array.from({ length: 11 }).map((_, idx) => (
                          <div
                            key={`rule-x-${idx}`}
                            className="text-[10px] text-slate-700"
                            style={{ width: "10%" }}
                          >
                            {idx * 10}
                          </div>
                        ))}
                      </div>

                      <div className="flex">
                        <div className="mr-2 flex flex-col justify-between py-1">
                          {Array.from({ length: 11 }).map((_, idx) => (
                            <div
                              key={`rule-y-${idx}`}
                              className="text-[10px] text-slate-700"
                            >
                              {idx * 10}
                            </div>
                          ))}
                        </div>
                        <div
                          ref={editorCanvasRef}
                          className="relative flex-1 rounded-md overflow-hidden border border-ink-500/40"
                        >
                          <img
                            src={
                              templateUrl ||
                              "/templates/sabyasachi_dutta_voterslip_format.png"
                            }
                            alt="Voter slip template editor"
                            className="w-full h-auto block"
                          />

                          {showFineGrid && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(to right, rgba(15,23,42,0.15) 0px, rgba(15,23,42,0.15) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(to bottom, rgba(15,23,42,0.15) 0px, rgba(15,23,42,0.15) 1px, transparent 1px, transparent 20px)",
                              }}
                            />
                          )}

                          {manualBoxes.map((box, idx) => {
                            const css = toCssBox(box);
                            const isSelected = selectedBoxId === box.id;
                            const label = box.label || "unlabeled";
                            const sampleText = SAMPLE_VALUES[label] || "Sample";
                            return (
                              <div
                                key={`editor-box-${box.id}`}
                                className={`absolute border-2 ${isSelected ? "border-blue-600 bg-blue-500/10" : "border-emerald-600 bg-emerald-500/10"}`}
                                style={{
                                  left: `${css.left * 100}%`,
                                  top: `${css.top * 100}%`,
                                  width: `${css.width * 100}%`,
                                  height: `${css.height * 100}%`,
                                  cursor: isEditMode ? "move" : "default",
                                }}
                                onMouseDown={(event) =>
                                  handleStartInteraction(
                                    event,
                                    box,
                                    "move",
                                    "editor",
                                  )
                                }
                                onClick={() => setSelectedBoxId(box.id)}
                              >
                                <div className="absolute -top-5 left-0 bg-slate-900/90 text-[10px] text-white px-1 rounded-sm pointer-events-none">
                                  #{idx + 1} {label}
                                </div>

                                <div className="text-[11px] text-slate-900 px-1 truncate pointer-events-none">
                                  {sampleText}
                                </div>

                                {[
                                  {
                                    corner: "nw",
                                    cls: "-left-1.5 -top-1.5 cursor-nwse-resize",
                                  },
                                  {
                                    corner: "ne",
                                    cls: "-right-1.5 -top-1.5 cursor-nesw-resize",
                                  },
                                  {
                                    corner: "sw",
                                    cls: "-left-1.5 -bottom-1.5 cursor-nesw-resize",
                                  },
                                  {
                                    corner: "se",
                                    cls: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
                                  },
                                ].map((handle) => (
                                  <button
                                    key={`handle-${box.id}-${handle.corner}`}
                                    type="button"
                                    className={`absolute h-3.5 w-3.5 rounded-sm border border-blue-100 bg-blue-600 ${handle.cls}`}
                                    onMouseDown={(event) =>
                                      handleStartInteraction(
                                        event,
                                        box,
                                        "resize",
                                        "editor",
                                        handle.corner,
                                      )
                                    }
                                    aria-label={`Resize ${handle.corner}`}
                                  />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {mappingRows.length > 0 && (
                    <div className="rounded-md border border-ink-500/40 bg-ink-800/40 p-3 overflow-auto">
                      <h5 className="text-sm font-semibold text-slate-100 mb-2">
                        Mapping Corrections
                      </h5>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-300 border-b border-ink-500/40">
                            <th className="py-2 pr-2 text-left">Field</th>
                            <th className="py-2 pr-2 text-left">Box Index</th>
                            <th className="py-2 pr-2 text-left">Source</th>
                            <th className="py-2 pr-2 text-left">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mappingRows.map((row) => (
                            <tr
                              key={`editor-map-${row.id}`}
                              className="border-b border-ink-500/20"
                            >
                              <td className="py-2 pr-2">
                                <select
                                  value={row.field || ""}
                                  onChange={(e) =>
                                    handleMappingFieldChange(
                                      row.id,
                                      e.target.value,
                                    )
                                  }
                                  disabled={!isEditMode}
                                >
                                  <option value="">Unmapped</option>
                                  {REQUIRED_FIELDS.map((field) => (
                                    <option
                                      key={`editor-map-${row.id}-${field}`}
                                      value={field}
                                    >
                                      {FIELD_LABELS[field] || field}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-2">
                                <select
                                  value={String(row.boxId || "")}
                                  onChange={(e) =>
                                    handleMappingBoxChange(
                                      row.id,
                                      e.target.value,
                                    )
                                  }
                                  disabled={!isEditMode}
                                >
                                  {manualBoxes.map((box, idx) => (
                                    <option
                                      key={`editor-map-box-${row.id}-${box.id}`}
                                      value={String(box.id)}
                                    >
                                      #{idx + 1}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 pr-2 text-slate-300">
                                {row.source || "auto"}
                              </td>
                              <td className="py-2 pr-2 text-slate-300">
                                {row.confidence ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!mappingValidation.valid && (
                        <p className="mt-2 text-xs text-amber-300">
                          {mappingValidation.reason}
                        </p>
                      )}
                    </div>
                  )}
                </section>

                <aside className="xl:col-span-3 rounded-lg border border-ink-400/40 bg-ink-900/50 p-3 space-y-3 overflow-auto">
                  <h5 className="text-sm font-semibold text-slate-100">
                    Live Measurements
                  </h5>
                  {selectedBox && selectedBoxMetrics ? (
                    <>
                      <div className="rounded-md border border-ink-500/40 bg-ink-800/40 p-2 text-xs text-slate-200">
                        <div className="font-semibold mb-1">Pixel</div>
                        <div>x: {selectedBoxMetrics.px.x}px</div>
                        <div>y: {selectedBoxMetrics.px.y}px</div>
                        <div>w: {selectedBoxMetrics.px.width}px</div>
                        <div>h: {selectedBoxMetrics.px.height}px</div>
                      </div>
                      <div className="rounded-md border border-ink-500/40 bg-ink-800/40 p-2 text-xs text-slate-200">
                        <div className="font-semibold mb-1">Normalized</div>
                        <div>
                          x: {selectedBoxMetrics.normalized.x.toFixed(4)}
                        </div>
                        <div>
                          y: {selectedBoxMetrics.normalized.y.toFixed(4)}
                        </div>
                        <div>
                          w: {selectedBoxMetrics.normalized.width.toFixed(4)}
                        </div>
                        <div>
                          h: {selectedBoxMetrics.normalized.height.toFixed(4)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="editorBoxLabel">Field</label>
                          <select
                            id="editorBoxLabel"
                            value={selectedBox.label || ""}
                            onChange={(e) =>
                              updateSelectedBox({ label: e.target.value })
                            }
                          >
                            <option value="">Unlabeled</option>
                            {REQUIRED_FIELDS.map((field) => (
                              <option
                                key={`editor-field-${field}`}
                                value={field}
                              >
                                {FIELD_LABELS[field] || field}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="editorBoxAlign">Align</label>
                          <select
                            id="editorBoxAlign"
                            value={selectedBox.align || "left"}
                            onChange={(e) =>
                              updateSelectedBox({ align: e.target.value })
                            }
                          >
                            <option value="left">left</option>
                            <option value="center">center</option>
                            <option value="right">right</option>
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400">
                      Select a box to view measurements.
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-ink-500/40">
                    <button
                      type="button"
                      className="btn btn-secondary w-full"
                      onClick={handleAutoLabels}
                      disabled={!isEditMode || busyAction === "auto-label"}
                    >
                      {busyAction === "auto-label"
                        ? "Labeling..."
                        : "Auto Label Boxes"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      onClick={() =>
                        handleSaveManualProfile({ closeOnSuccess: true })
                      }
                      disabled={!isEditMode || busyAction === "save-manual"}
                    >
                      {busyAction === "save-manual"
                        ? "Saving..."
                        : "Save Profile"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary w-full"
                      onClick={closeEditor}
                    >
                      Discard / Close
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
