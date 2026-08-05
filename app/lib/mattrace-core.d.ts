export type DemoStage = {
  label: string;
  status: "pending" | "active" | "complete";
};

export type DemoState = {
  activeStage: number;
  stages: DemoStage[];
  status: "running" | "complete";
  records: number;
};

export const DEFAULT_PROVIDER: Readonly<{
  gateway: string;
  model: string;
  apiKey: string;
}>;

export function createDemoState(): DemoState;
export function advanceDemoState(state: DemoState): DemoState;
export function serializeExport(
  format: "json" | "csv" | "markdown",
  records: Array<Record<string, string>>,
): string;

