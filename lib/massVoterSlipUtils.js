const CONTROL_CHAR_REGEX =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

function toSafeText(value) {
  return String(value ?? "");
}

export function sanitizeMassSlipField(value) {
  const input = toSafeText(value);
  const normalized = input.normalize("NFC");
  const withoutControls = normalized.replace(CONTROL_CHAR_REGEX, "");
  const collapsedSpaces = withoutControls
    .replace(/[^\S\r\n\t]{2,}/g, " ")
    .trim();

  return {
    value: collapsedSpaces,
    changed: collapsedSpaces !== input,
  };
}

export function sanitizeMassSlipPayload(payload = {}) {
  const sanitizedPayload = {};
  let changed = false;

  Object.entries(payload).forEach(([key, rawValue]) => {
    if (rawValue === undefined || rawValue === null) return;

    if (typeof rawValue === "string") {
      const result = sanitizeMassSlipField(rawValue);
      if (result.value) {
        sanitizedPayload[key] = result.value;
      }
      if (result.changed) {
        changed = true;
      }
      return;
    }

    sanitizedPayload[key] = rawValue;
  });

  return {
    payload: sanitizedPayload,
    changed,
  };
}

export function normalizePdfErrorMessage(message = "") {
  const raw = String(message || "");
  const lower = raw.toLowerCase();

  const hasUnicodeEncodingIssue =
    lower.includes("pdf generation failed due to font encoding") ||
    lower.includes("winansi") ||
    lower.includes("cannot encode") ||
    (lower.includes("font") && lower.includes("encoding")) ||
    (lower.includes("font") && lower.includes("glyph"));

  if (!hasUnicodeEncodingIssue) return raw;

  const charMatch = raw.match(/cannot encode\s+"(.+?)"/i);
  const offendingChar = charMatch?.[1];
  const charSuffix = offendingChar
    ? ` Problematic character: "${offendingChar}".`
    : "";

  return `PDF generation failed due to font encoding on backend.${charSuffix} Use a Unicode-capable embedded font and retry. You can also restart with previous filters after removing unsupported control characters.`;
}
