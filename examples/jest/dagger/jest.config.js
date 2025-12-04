export default {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [".ts"],
  injectGlobals: true,
  setupFilesAfterEnv: ["@otel-test-runner/jest-test/register"],
};
