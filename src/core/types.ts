export type SeriesPoint = { t: string; v: number };

export type Snapshot = {
  capturedAt: string;
  series: SeriesPoint[];
  stat: number;
};

export type ThresholdRule = {
  kind: "threshold";
  stat: "last";
  crossesAbove?: number;
  crossesBelow?: number;
};

export type RegimeRule = {
  kind: "regime";
  window: number;
  minRatio: number;
};

export type DeltaRule = ThresholdRule | RegimeRule;

export type Delta = {
  rule: DeltaRule;
  before: Snapshot;
  after: Snapshot;
};
