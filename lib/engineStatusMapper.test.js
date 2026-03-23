import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDispatchTier,
  extractAutomaticRetryRounds,
  extractPaidFallbackActive,
  formatDispatchTierLabel,
  isProcessingSessionStatus,
  isTerminalSessionStatus,
  normalizeApiKeysStatus,
} from "./engineStatusMapper.js";

test("normalizeApiKeysStatus maps pools, tier and engine metrics", () => {
  const payload = {
    activeDispatchTier: "paid",
    totalEngines: 3,
    pools: {
      free: {
        total: 2,
        active: 0,
        rateLimited: 1,
        exhausted: 1,
        busy: 0,
        available: 0,
      },
      paid: {
        total: 1,
        active: 1,
        rateLimited: 0,
        exhausted: 0,
        busy: 0,
        available: 1,
      },
    },
    engines: [
      {
        engineId: "E1",
        tier: "free",
        status: "rate_limited",
        busy: false,
        keyPreview: "sk-f...12",
        metrics: { totalRequests: 22, successCount: 19 },
      },
      {
        engineId: "E2",
        tier: "free",
        status: "exhausted",
        busy: false,
        keyPreview: "sk-f...34",
        metrics: { totalRequests: 25, successCount: 21 },
      },
      {
        engineId: "E3",
        tier: "paid",
        status: "active",
        busy: false,
        keyPreview: "sk-p...56",
        metrics: { totalRequests: 4, successCount: 4 },
      },
    ],
  };

  const normalized = normalizeApiKeysStatus(payload);

  assert.equal(normalized.activeDispatchTier, "paid");
  assert.equal(normalized.totalEngines, 3);
  assert.equal(normalized.pools.free.exhausted, 1);
  assert.equal(normalized.pools.paid.available, 1);
  assert.equal(normalized.engines[2].tier, "paid");
  assert.equal(normalized.engines[2].metrics.successCount, 4);
});

test("session status helpers detect processing and terminal transitions", () => {
  assert.equal(isProcessingSessionStatus("processing"), true);
  assert.equal(isProcessingSessionStatus("pending"), true);
  assert.equal(isTerminalSessionStatus("completed"), true);
  assert.equal(isTerminalSessionStatus("failed"), true);
  assert.equal(isTerminalSessionStatus("processing"), false);
});

test("extractAutomaticRetryRounds supports numeric and missing values", () => {
  assert.equal(extractAutomaticRetryRounds({ automaticRetryRounds: 2 }), 2);
  assert.equal(extractAutomaticRetryRounds({}), null);
});

test("dispatch helpers map fallback flag and user-facing labels", () => {
  assert.equal(extractDispatchTier({ activeDispatchTier: "paid" }), "paid");
  assert.equal(extractPaidFallbackActive({ paidFallbackActive: true }), true);
  assert.equal(extractPaidFallbackActive({ activeDispatchTier: "paid" }), true);
  assert.equal(formatDispatchTierLabel("free"), "FREE (Primary)");
  assert.equal(formatDispatchTierLabel("paid"), "PAID (Fallback Active)");
});
