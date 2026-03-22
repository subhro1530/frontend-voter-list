export type DispatchTier = "free" | "paid";
export type EngineStatus = "active" | "rate_limited" | "exhausted" | "unknown";

export interface EngineMetrics {
  totalRequests: number;
  successCount: number;
}

export interface EngineStatusItem {
  engineId: string;
  tier: DispatchTier;
  status: EngineStatus;
  busy: boolean;
  keyPreview: string;
  metrics: EngineMetrics;
}

export interface EnginePoolSnapshot {
  total: number;
  active: number;
  rateLimited: number;
  exhausted: number;
  busy: number;
  available: number;
}

export interface ApiKeysStatusResponse {
  totalEngines: number;
  activeEngines: number;
  rateLimitedEngines: number;
  exhaustedEngines: number;
  busyEngines: number;
  availableEngines: number;
  activeDispatchTier: DispatchTier;
  pools: {
    free: EnginePoolSnapshot;
    paid: EnginePoolSnapshot;
  };
  engines: EngineStatusItem[];
}

export interface SessionStatusSnapshot {
  statusText: string;
  processed: number;
  total: number;
  percent: number;
  voterCount: number;
  dispatchTier?: DispatchTier;
  automaticRetryRounds?: number;
}
