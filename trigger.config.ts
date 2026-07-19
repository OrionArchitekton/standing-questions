import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_zzzpureafpslkdubhxkc",
  // node-22: the default "node" runtime lacks the global WebSocket the
  // Jetstream capture uses (prod runs failed with "WebSocket is not defined")
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 300,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      // Deploy-time sync from the local (doppler-provided) env into the
      // Trigger.dev project env, so deployed tasks can reach ClickHouse Cloud.
      syncEnvVars(() =>
        [
          "CLICKHOUSE_URL",
          "CLICKHOUSE_USER",
          "CLICKHOUSE_PASSWORD",
          "DATABASE_URL",
          // sq-chat agent: streamText model + the compile step inside askFirehose
          "ANTHROPIC_API_KEY",
        ]
          .filter((name) => process.env[name])
          .map((name) => ({ name, value: process.env[name] as string, isSecret: true })),
      ),
    ],
  },
});
