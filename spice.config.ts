import { defineConfig } from "@spicemod/creator";
import { ProjectName, ProjectVersion } from "./project/config";

const env = (globalThis as typeof globalThis & { process?: { env: Record<string, string | undefined> } }).process?.env;
export default defineConfig({
  name: ProjectName,
  version: env?.SPICY_LYRICS_BUILD_VERSION ?? ProjectVersion,
  framework: "react",
  linter: "oxlint",
  template: "extension",
  packageManager: "npm",
  cssId: "slstyles",
  devModeVarName: "__SLdev__m",
  esbuildOptions: {
    legalComments: "inline",
    define: { __SL_BUILD_HOTFIX__: JSON.stringify(Number(env?.SPICY_LYRICS_BUILD_HOTFIX ?? 0)) },
  },
});
