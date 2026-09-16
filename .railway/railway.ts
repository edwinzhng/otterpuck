import { defineRailway, github, project, service } from "railway/iac";
export default defineRailway(() => {
  const regionalService = (
    name: string,
    region: string,
    id: string,
  ): ReturnType<typeof service> =>
    service(name, {
      source: github("edwinzhng/otterpuck", { branch: "main" }),
      build: {
        builder: "DOCKERFILE",
        dockerfilePath: "services/Dockerfile",
        watchPatterns: [
          "services/**",
          "src/**",
          "package.json",
          "bun.lock",
          ".railway/**",
        ],
      },
      start: "bun run services/server.ts",
      healthcheck: "/health",
      healthcheckTimeout: 30,
      replicas: { [region]: 1 },
      deploy: {
        restartPolicyType: "ON_FAILURE",
        restartPolicyMaxRetries: 5,
        sleepApplication: false,
      },
      env: {
        NODE_ENV: "production",
        ROOM_REGION: id,
        ALLOWED_ORIGINS:
          "https://otterpuck.edwinzhang.com,https://otterpuck.vercel.app",
        PORT: "3210",
      },
    });
  return project("otterpuck", {
    resources: [
      regionalService("rooms-us", "us-east4-eqdc4a", "us"),
      regionalService("rooms-eu", "europe-west4-drams3a", "eu"),
    ],
  });
});
