# Third-Party Notices

Startup in a Box incorporates or is inspired by the following open-source projects. Thank you to every maintainer.

## Vendored / forked code (included in this repo)

| Project | License | What we use it for |
|---------|---------|-------------------|
| [ai-town](https://github.com/a16z-infra/ai-town) | MIT | PixiJS character stage, sprite system, tilemap engine, `32x32folk.png` tileset. Forked — Convex backend removed, AG-UI event reducer grafted on. |
| [agent-flow](https://github.com/patoles/agent-flow) | Apache 2.0 | Factory node-graph visualizer. Vendored `web/` subtree — see `frontend/vendor/agent-flow/ATTRIBUTION.md` for the exact upstream pin and edit log. |
| [caveman](https://github.com/juliusbrusee/caveman) | MIT | Claude Code plugin for ultra-compressed agent output (~75 % token cut). |

## Assets

| Asset | License | Source |
|-------|---------|--------|
| `frontend/public/assets/retro-office.png` | CC0 | [Cool School tileset](https://opengameart.org/content/cool-school-tileset) on OpenGameArt |
| `frontend/public/assets/32x32folk.png` | MIT | Inherited from [ai-town](https://github.com/a16z-infra/ai-town) |
| `frontend/public/assets/boardrooms/*.png` | MIT | Project-original pre-rendered boardroom backgrounds |

## Key frameworks & libraries (dependencies, not vendored)

| Project | Role in this demo |
|---------|-------------------|
| [Google ADK](https://github.com/google/adk-python) | Boardroom agent framework (orchestrator) |
| [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code-sdk) | Factory agent framework |
| [AG-UI Protocol](https://github.com/ag-ui-protocol/ag-ui) | Event streaming protocol — one reducer, two backends |
| [CopilotKit](https://github.com/CopilotKit/CopilotKit) | Frontend AG-UI integration |
| [PixiJS](https://pixijs.com/) | 2D rendering engine for the pixel-art stage |
| [Next.js](https://nextjs.org/) | Frontend framework (App Router) |
| [FastAPI](https://fastapi.tiangolo.com/) | Python HTTP framework for both backends |
| [LiteLLM](https://github.com/BerriAI/litellm) | Model routing — lets the orchestrator talk to Gemini via OpenRouter or native google-genai |
| [rtk](https://github.com/rtk-ai/rtk) | Optional Bash output compression for Claude Code (not vendored — runtime dep) |

## The tileset story

The boardroom pixel art started with [LimeZu's Modern Interiors](https://limezu.itch.io/) tileset. We built a web-based tile-authoring tool to compose rooms from individual tiles, but the workflow was too brittle for live-demo reliability. We switched to single pre-rendered background images (`boardrooms/*.png`). The Modern Interiors tileset is not redistributable, so it and the authoring tool have been removed from this public release.
