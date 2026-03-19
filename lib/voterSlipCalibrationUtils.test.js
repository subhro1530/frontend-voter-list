import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMappingRowsToBoxes,
  buildFieldsPayloadFromBoxes,
  canUseManualCalibration,
  inferAutoLabelRows,
  validateUniqueFieldAssignments,
} from "./voterSlipCalibrationUtils.js";

test("admin manual control visibility guard", () => {
  assert.equal(
    canUseManualCalibration({
      permissions: {
        isAdmin: true,
        canUseManualCalibration: true,
      },
    }),
    true,
  );

  assert.equal(
    canUseManualCalibration({
      permissions: {
        isAdmin: false,
        canUseManualCalibration: true,
      },
    }),
    false,
  );
});

test("auto-label response maps to editable rows", () => {
  const boxes = [{ id: "box-a" }, { id: "box-b" }];
  const response = {
    mapping: [
      { boxId: "box-a", field: "name", source: "gemini", confidence: 0.95 },
      { boxId: "box-b", field: "father", source: "gemini", confidence: 0.89 },
    ],
  };

  const rows = inferAutoLabelRows(response, boxes);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].field, "name");
  assert.equal(rows[0].boxId, "box-a");
  assert.equal(rows[0].source, "gemini");
  assert.equal(rows[0].confidence, "0.95");
});

test("save/apply happy path payload validity helpers", () => {
  const boxes = [
    {
      id: "box-1",
      label: "name",
      x: 0.1,
      y: 0.6,
      width: 0.3,
      height: 0.1,
      align: "left",
      maxLines: 2,
      maxFontSize: 14,
      minFontSize: 9,
      paddingX: 0,
      paddingY: 0,
    },
    {
      id: "box-2",
      label: "father",
      x: 0.1,
      y: 0.5,
      width: 0.3,
      height: 0.1,
      align: "left",
      maxLines: 2,
      maxFontSize: 14,
      minFontSize: 9,
      paddingX: 0,
      paddingY: 0,
    },
  ];

  const rows = [
    { id: "map-1", field: "name", boxId: "box-1" },
    { id: "map-2", field: "father", boxId: "box-2" },
  ];

  const applied = applyMappingRowsToBoxes(boxes, rows);
  assert.equal(applied[0].label, "name");
  assert.equal(applied[1].label, "father");

  const validation = validateUniqueFieldAssignments(rows, ["name", "father"]);
  assert.equal(validation.valid, true);

  const fields = buildFieldsPayloadFromBoxes(applied, ["name", "father"]);
  assert.equal(Object.keys(fields).length, 2);
  assert.equal(fields.name.width, 0.3);
  assert.equal(fields.father.height, 0.1);
});
