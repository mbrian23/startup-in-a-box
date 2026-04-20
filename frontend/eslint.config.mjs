import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  reactYouMightNotNeedAnEffect.configs.recommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored agent-flow subtree — don't lint upstream code so diffs
    // against github.com/patoles/agent-flow stay readable.
    "vendor/**",
  ]),

  // -----------------------------------------------------------------------
  // Import boundary: AG-UI protocol layer must not import spatial concerns.
  // Spatial logic (zones, TILE_SIZE, positions) belongs in the pixi layer.
  // Also: WorkerState is pixi-private.
  // -----------------------------------------------------------------------
  {
    files: ["src/hooks/**/*.ts", "src/hooks/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/lib/zones", "**/lib/zones.*"], message: "AG-UI hooks must not import spatial data. Zones belong in the pixi layer." },
          { group: ["**/pixi/*", "**/pixi/**"], message: "AG-UI hooks must not import from the pixi layer." },
        ],
      }],
    },
  },

  // -----------------------------------------------------------------------
  // Import boundary: Screen components must not import spatial constants.
  // Also: WorkerState is pixi-private.
  //
  // App.tsx is the composition root — it's the one place in components/
  // that mounts the shared pixi shell, so it's exempt from the pixi ban.
  // -----------------------------------------------------------------------
  {
    files: ["src/components/**/*.ts", "src/components/**/*.tsx"],
    ignores: ["src/components/App.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/lib/zones", "**/lib/zones.*"], message: "Screen components must not import spatial data. Pass it through the scene." },
          { group: ["**/pixi/*", "**/pixi/**"], message: "Screen components must not import from the pixi layer directly." },
        ],
      }],
    },
  },

  // -----------------------------------------------------------------------
  // Import boundary: Non-pixi code must not import pixi/types (WorkerState).
  // Excludes hooks/ and components/ (handled above with stricter rules).
  // -----------------------------------------------------------------------
  {
    files: ["src/lib/**/*.ts", "src/lib/**/*.tsx", "src/data/**/*.ts", "src/data/**/*.tsx", "src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/pixi/types", "**/pixi/types.*"], message: "WorkerState is pixi-private. Use AgentState from hooks/ag-ui/types instead." },
        ],
      }],
    },
  },

  // -----------------------------------------------------------------------
  // Pixi layer exceptions. DOM transitions live in motion; pixi-native
  // animations live on @pixi/react's useTick, which legitimately needs:
  //   • render-time randomness for one-shot mote/bob/flash seeds
  //     (flagged by react-hooks/purity)
  //   • effect-based sync of incoming props into refs read at 60fps
  //     (flagged by react-you-might-not-need-an-effect/*).
  // The plugin is DOM-centric and doesn't fit pixi's render model, so
  // we disable just those rules inside src/pixi/**.
  // -----------------------------------------------------------------------
  {
    files: ["src/pixi/**/*.ts", "src/pixi/**/*.tsx"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-you-might-not-need-an-effect/no-adjust-state-on-prop-change": "off",
      "react-you-might-not-need-an-effect/no-derived-state": "off",
    },
  },

]);

export default eslintConfig;
