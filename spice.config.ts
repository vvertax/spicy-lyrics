import { defineConfig } from "@spicemod/creator";
import { ProjectName, ProjectVersion } from "./project/config";

export default defineConfig({
  name: ProjectName,
  version: process.env.SPICY_LYRICS_BUILD_VERSION ?? ProjectVersion,
  framework: "react",
  linter: "oxlint",
  template: "extension",
  packageManager: "npm",
  cssId: "slstyles",
  devModeVarName: "__SLdev__m",
  esbuildOptions: {
    legalComments: "inline",
  },
});
