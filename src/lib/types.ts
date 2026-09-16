export type ServerInfo = {
  id: string;
  name: string;
  description: string;
  unit: string;
  scope: "user" | "system";
  configs: string[];
  state: string;
  subState: string;
  enabled: boolean;
  canEnable: boolean;
  loaded: boolean;
};
export type ConfigFile = { text: string; revision: string; editable: boolean };
export type Action = "start" | "stop" | "restart" | "enable" | "disable";
export type ServerLogs = { text: string; limit: number };
export type Capacity = { used: number; total: number };
export type HostResources = {
  cpuPercent: number | null;
  cpuCount: number;
  memory: Capacity | null;
  disk: Capacity | null;
  uptimeSeconds: number;
};
