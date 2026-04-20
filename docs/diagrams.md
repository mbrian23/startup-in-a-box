# Startup-in-a-Box — Diagram Atlas

Every architectural diagram in one page. Each one has a rendered SVG companion under `./diagrams/` — useful for pasting into slides.

For the prose version, see [`architecture.md`](./architecture.md).

---

## 1. System at a glance

Three independent services unified by the **AG-UI Protocol** over SSE.

- 🟦 **Orchestrator** (`:8000`) — Python · FastAPI · **Google ADK** · strategic planning ("Boardroom")
- 🟩 **Factory** (`:8888`) — Python · FastAPI · **Claude Agent SDK** + vendored Caveman plugin · tactical execution ("Factory")
- 🟨 **Frontend** (`:3000`) — Next.js 16 · React 19 · PixiJS · CopilotKit · dual-screen visualization

```mermaid
flowchart LR
    user(["👤 Dumb Idea"])

    subgraph FE["🟨 Frontend · :3000 · Next.js 16 + PixiJS"]
        direction TB
        NX["App Router<br/>layout + page"]
        CK[/"/api/copilotkit<br/>SSE proxy"/]
        BR(["🎬 Boardroom Screen<br/>PixiJS stage"])
        FC(["🏭 Factory Screen<br/>agent-flow"])
        HITL{{"Human-in-the-loop<br/>ApprovalCard"}}
    end

    subgraph ORCH["🟦 Orchestrator · :8000 · Google ADK"]
        direction TB
        CEO(("Theo · CEO<br/>LlmAgent coordinator"))
        SPEC["Specialists (AgentTools)<br/>data_structurer · market_analyst<br/>brand_designer · business_planner<br/>strategist · cto · reviewer"]
        TOOLS{{"FunctionTools<br/>send_back · start_factory"}}
        ART[("Artifacts<br/>StrategyBoard · Brand<br/>BusinessPlan · LeanCanvas<br/>BuildPlan · PlanReview")]
    end

    subgraph FAC["🟩 Factory · :8888 · Claude Agent SDK"]
        direction TB
        RUN["runner.py<br/>ClaudeSDKClient"]
        RALPH{{"Caveman compression plugin"}}
        SUBS["Subagents (AgentDefinition)<br/>architect · implementer<br/>tester · devops · build_reviewer"]
        HOOKS[("Quality hooks<br/>pre_bash_guard<br/>rtk_rewrite<br/>post_write_lint")]
    end

    subgraph EXT["☁️ External"]
        direction TB
        LLM[("Gemini · Anthropic<br/>LM Studio")]
        GH(["GitHub"])
        VERCEL(["Vercel + Neon<br/>Stripe + AI Gateway"])
    end

    user ==>|"prompt"| NX
    NX --> CK
    CK == "AG-UI SSE" ==> CEO
    CEO == "AG-UI SSE" ==> BR
    RUN == "AG-UI SSE" ==> FC
    FC <-.-> HITL

    CEO <-->|"AgentTool call"| SPEC
    SPEC -. writes .-> ART
    CEO --> TOOLS
    TOOLS ==>|"POST /factory"| RUN

    RUN --> RALPH
    RALPH --> SUBS
    RUN <--> HOOKS
    SUBS -. writes .-> RUN

    SPEC <--> LLM
    RUN <--> LLM
    SUBS ==> GH
    SUBS ==> VERCEL
    VERCEL -. "deployed_url" .-> RUN
    RUN == "RUN_FINISHED" ==> TOOLS

    classDef frontend fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#1f2937
    classDef orchestrator fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1f2937
    classDef factory fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#1f2937
    classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px,stroke-dasharray:4 3,color:#1f2937
    class FE,NX,CK,BR,FC,HITL frontend
    class ORCH,CEO,SPEC,TOOLS,ART orchestrator
    class FAC,RUN,RALPH,SUBS,HOOKS factory
    class EXT,LLM,GH,VERCEL external
```

**Edge legend** — `==>` heavy = primary data path · `-->` solid = sync call · `-.->` dashed = streamed events / async

---

## 2. End-to-end pipeline sequence

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend :3000
    participant O as Orchestrator (ADK · :8000)
    participant F as Factory (Claude SDK · :8888)
    participant V as GitHub + Vercel

    U->>+FE: submits a genuinely stupid idea
    FE->>+O: POST /orchestrator (RunAgentInput)

    rect rgb(219, 234, 254)
    note over O: Theo (CEO · LlmAgent) runs the boardroom
    O-->>FE: RUN_STARTED and TEXT_MESSAGE
    O->>O: AgentTool -> data_structurer (StrategyBoard)
    O->>O: AgentTool -> market_analyst
    O->>O: AgentTool -> brand_designer (Brand)
    O->>O: AgentTool -> business_planner (BusinessPlan)
    O->>O: AgentTool -> strategist (LeanCanvas sealed)
    O->>O: AgentTool -> cto (BuildPlan)
    O->>O: AgentTool -> reviewer (verdict)
    O-->>FE: STATE_DELTA board.hitl=awaiting
    end

    rect rgb(253, 230, 138)
    note over FE: HITL gate — 6s auto-approve countdown
    FE-->>O: POST /api/hitl { approved: true }
    end

    O-->>FE: STATE_DELTA handoff_stage=preparing
    O->>+F: POST /factory (BuildPlan + LeanCanvas + Brand)
    O-->>FE: STATE_DELTA handoff_stage=launched

    rect rgb(209, 250, 229)
    note over F: Supervisor delegates steps until deploy completes
    loop per iteration (max 10)
        F->>F: Agent -> architect
        F->>F: Agent -> implementer
        F->>F: Agent -> tester
        F->>F: Agent -> build_reviewer
        F-->>FE: coarse progress
    end
    F->>F: Agent -> devops
    F->>+V: git init, gh repo create, vercel --prod
    V-->>-F: deployed_url, github_url
    F->>F: devops emits DEPLOYED promise
    end

    F-->>-O: RUN_FINISHED (artifacts + urls)
    O-->>FE: STATE_DELTA handoff_stage=returned
    O-->>-FE: RUN_FINISHED
    FE-->>-U: live Vercel URL + GitHub repo
```

---

## 3. The ADK delegator pattern

The CEO is an `LlmAgent` that keeps control across every turn. Specialists are `AgentTool(agent=child)` — not `sub_agents` — so returns come back to the CEO instead of dead-ending in a schema-constrained child.

```mermaid
flowchart TB
    subgraph CEO_BOX["Theo · CEO — LlmAgent coordinator"]
        CEO(("CEO<br/>LlmAgent"))
    end

    subgraph TOOLS_BOX["Tools on the CEO"]
        direction TB
        T1["AgentTool(data_structurer)"]
        T2["AgentTool(market_analyst)<br/>+ google_search"]
        T3["AgentTool(brand_designer)"]
        T4["AgentTool(business_planner)"]
        T5["AgentTool(strategist · Yara)"]
        T6["AgentTool(cto · Sam)"]
        T7["AgentTool(reviewer)"]
        T8["FunctionTool<br/>send_back_with_notes"]
        T9["FunctionTool<br/>start_factory"]
    end

    subgraph STATE_BOX["session.state (via output_key)"]
        direction TB
        S1[("strategy_board")]
        S2[("market_analysis")]
        S3[("brand")]
        S4[("business_plan")]
        S5[("lean_canvas")]
        S6[("build_plan")]
        S7[("plan_review")]
    end

    CEO -- "call → run → return JSON" --> T1
    CEO --> T2
    CEO --> T3
    CEO --> T4
    CEO --> T5
    CEO --> T6
    CEO --> T7
    CEO -. "reviewer rejected" .-> T8
    CEO == "reviewer approved" ==> T9

    T1 -. output_key .-> S1
    T2 -. output_key .-> S2
    T3 -. output_key .-> S3
    T4 -. output_key .-> S4
    T5 -. output_key .-> S5
    T6 -. output_key .-> S6
    T7 -. output_key .-> S7

    T9 ==>|"POST /factory"| FACTORY(["Claude Agent SDK<br/>Factory"])

    classDef ceo fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#1f2937
    classDef tool fill:#ede9fe,stroke:#7c3aed,stroke-width:1.5px,color:#1f2937
    classDef state fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#1f2937
    classDef factory fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#1f2937
    class CEO,CEO_BOX ceo
    class T1,T2,T3,T4,T5,T6,T7,T8,T9,TOOLS_BOX tool
    class S1,S2,S3,S4,S5,S6,S7,STATE_BOX state
    class FACTORY factory
```

> **Why not `sub_agents=[...]`?** A child with `output_schema` set can't transfer control back. `AgentTool` keeps the CEO in the driver's seat every turn.

---

## 4. The Claude Agent SDK loop

```mermaid
flowchart TB
    subgraph RUN["runner.py · ClaudeSDKClient session"]
        direction TB
        START(["POST /factory<br/>BuildPlan + LeanCanvas + Brand"])
        OPT["ClaudeAgentOptions<br/>preset=claude_code<br/>setting_sources=[]<br/>cwd=workspace/&lt;thread&gt;"]
        CLIENT{"ClaudeSDKClient<br/>async context"}
        QUERY["client.query(BuildPlan prompt)"]
    end

    subgraph PLUGINS["Vendored plugins"]
        direction TB
        RALPH{{"Supervisor<br/>delegates each BuildPlan step<br/>to the right subagent"}}
        CAVE{{"caveman<br/>SessionStart + UserPromptSubmit hooks<br/>~75% token compression"}}
    end

    subgraph HOOKS["Quality hooks (Python callbacks)"]
        direction TB
        H1["pre_bash_guard<br/>PreToolUse → deny destructive commands"]
        H2["rtk_rewrite<br/>PreToolUse → rtk rewrite (slim)"]
        H3["post_write_lint<br/>PostToolUse → flags lazy code"]
    end

    subgraph SUBS["Subagents · AgentDefinition"]
        direction TB
        SA1["architect"]
        SA2["implementer<br/>reads .claude/skills/*/SKILL.md"]
        SA3["tester"]
        SA4["devops"]
        SA5["build_reviewer"]
    end

    subgraph SKILLS["Skills · dual-path contracts"]
        direction TB
        SK1["stripe-checkout"]
        SK2["vercel-neon"]
        SK3["external-apis"]
    end

    START --> OPT --> CLIENT
    CLIENT --> QUERY
    QUERY --> RALPH
    RALPH --> SA1
    RALPH --> SA2
    RALPH --> SA3
    RALPH --> SA4
    RALPH --> SA5
    CAVE -. compresses .-> CLIENT
    H1 -. vets Bash .-> CLIENT
    H2 -. rewrites Bash .-> CLIENT
    H3 -. nudges Write/Edit .-> CLIENT
    SA2 -. reads .-> SK1
    SA2 -. reads .-> SK2
    SA2 -. reads .-> SK3
    SA4 ==>|"deploy URL printed"| EXIT(["RUN_FINISHED"])

    classDef run fill:#d1fae5,stroke:#059669,color:#1f2937
    classDef plug fill:#fce7f3,stroke:#be185d,color:#1f2937
    classDef hook fill:#fff7ed,stroke:#c2410c,color:#1f2937
    classDef sub fill:#ede9fe,stroke:#7c3aed,color:#1f2937
    classDef skill fill:#fef3c7,stroke:#d97706,color:#1f2937
    class RUN,START,OPT,CLIENT,QUERY,EXIT run
    class PLUGINS,RALPH,CAVE plug
    class HOOKS,H1,H2,H3 hook
    class SUBS,SA1,SA2,SA3,SA4,SA5 sub
    class SKILLS,SK1,SK2,SK3 skill
```

---

## 5. Handoff lifecycle (state machine)

The most subtle part of the system: the choreographed handoff between Boardroom and Factory. Both screens share `handoff_stage` via `STATE_DELTA` events.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> idle: server boots

    idle --> planning: user submits idea
    planning --> structuring: data_structurer writes
    structuring --> scanning: market_analyst runs
    scanning --> branding: brand_designer writes
    branding --> modeling: business_planner writes
    modeling --> sealing: strategist seals LeanCanvas
    sealing --> architecting: CTO emits BuildPlan
    architecting --> reviewing: reviewer decides
    reviewing --> architecting: send_back_with_notes
    reviewing --> hitl: reviewer approves + CEO calls start_factory

    hitl --> preparing: POST /api/hitl approved (6s auto-approve)
    hitl --> failed: rejected by operator
    preparing --> launched: POST /factory accepted
    launched --> building: factory RUN_STARTED

    building --> building: tool_result tick / progress
    building --> returned: RUN_FINISHED
    building --> failed: RUN_ERROR

    returned --> shipped: SHIPPED token animates back
    shipped --> [*]
    failed --> [*]

    note right of hitl
        HITLPanel opens on Boardroom,
        6s countdown, operator can
        cancel / approve / reject.
    end note

    note right of preparing
        Beat 1: scroll leaves,
        boardroom desaturates
    end note

    note right of building
        Split screen: boardroom
        dim with progress ticker
        (ticks on subagent tool_result),
        factory full agent-flow
    end note

    note right of shipped
        Beat 3: scroll returns,
        unicorn confetti
    end note
```

---

## 6. Framework comparison (teaching slide)

```mermaid
flowchart LR
    subgraph ADK["🟦 Google ADK — used for PLANNING"]
        direction TB
        ADK_USE["Strong fit when:<br/>• High-level reasoning + typed artifacts<br/>• Multiple specialists reporting to one leader<br/>• Structured outputs via Pydantic<br/>• Provider-flexible (Gemini + LiteLLM)"]
        ADK_PRIM["Primitives:<br/>• LlmAgent + instruction<br/>• AgentTool(child_agent)<br/>• FunctionTool<br/>• session.state + output_key<br/>• ag-ui-adk endpoint"]
    end

    subgraph CLAUDE["🟩 Claude Agent SDK — used for BUILDING"]
        direction TB
        CL_USE["Strong fit when:<br/>• Real filesystem + shell work<br/>• Loopy tactical execution<br/>• Rich built-in tool catalog<br/>• You want Claude Code's prompt for free"]
        CL_PRIM["Primitives:<br/>• ClaudeSDKClient + ClaudeAgentOptions<br/>• AgentDefinition (subagents)<br/>• plugins=[{type:'local',path}]<br/>• hooks (PreToolUse/PostToolUse)<br/>• setting_sources=[] for isolation<br/>• preset=claude_code + append"]
    end

    BRIDGE(["🤝 Handoff<br/>start_factory FunctionTool<br/>POST /factory<br/>{ build_plan, lean_canvas, brand }"])

    ADK ==>|"typed artifacts"| BRIDGE
    BRIDGE ==>|"prompt preamble"| CLAUDE

    classDef adk fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1f2937
    classDef claude fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#1f2937
    classDef bridge fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#1f2937
    class ADK,ADK_USE,ADK_PRIM adk
    class CLAUDE,CL_USE,CL_PRIM claude
    class BRIDGE bridge
```

---

## 7. The Lean Canvas funnel

The four upstream specialists write typed artifacts. Yara reconciles into the 9-block canvas. The CTO reads **only** the canvas — not the raw artifacts — so downstream decisions track a single sealed source of truth.

```mermaid
flowchart LR
    idea(["💡 Dumb idea"])

    subgraph STR["Structure"]
        SB["StrategyBoard"]
    end
    subgraph SCAN["Scan"]
        MA["MarketAnalysis"]
    end
    subgraph BRAND["Brand"]
        BR["Brand"]
    end
    subgraph MODEL["Model"]
        BP["BusinessPlan"]
    end
    subgraph SEAL["Seal"]
        LC[("LeanCanvas<br/>9 blocks · ground truth")]
    end
    subgraph PLAN["Plan"]
        CTO["BuildPlan"]
    end
    subgraph REVIEW["Review"]
        RV{"PlanReview"}
    end

    SHIP(["🚀 start_factory"])

    idea --> SB
    idea --> MA
    idea --> BR
    SB --> BP
    MA --> BP
    BR --> BP
    SB --> LC
    MA --> LC
    BR --> LC
    BP --> LC
    LC ==> CTO
    CTO --> RV
    RV -. "send_back" .-> CTO
    RV ==> SHIP
    LC -. "packed into POST" .-> SHIP
    BR -. "packed into POST" .-> SHIP

    classDef artifact fill:#fef3c7,stroke:#d97706,color:#1f2937
    classDef canvas fill:#fbbf24,stroke:#b45309,stroke-width:3px,color:#1f2937
    classDef ship fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#1f2937
    class SB,MA,BR,BP,CTO,RV artifact
    class LC canvas
    class SHIP ship
```

---

## 8. AG-UI event flow (one protocol, two backends)

```mermaid
flowchart LR
    subgraph BE["Backends speak AG-UI Protocol"]
        direction TB
        O["🟦 Orchestrator<br/>ag-ui-adk"]
        F["🟩 Factory<br/>hand-rolled encoder (stream.py)"]
    end

    subgraph WIRE["SSE wire format"]
        direction TB
        E1[["RUN_STARTED"]]
        E2[["TEXT_MESSAGE_START/CONTENT/END"]]
        E3[["TOOL_CALL_START/END"]]
        E4[["STATE_DELTA (JSON Patch)"]]
        E5[["STATE_SNAPSHOT"]]
        E6[["RUN_FINISHED / RUN_ERROR"]]
    end

    subgraph FE["🟨 Frontend (Next.js · CopilotKit · PixiJS)"]
        direction TB
        HK["useAgUiEvents reducer"]
        ST[("UI state<br/>active_agent, lean_canvas,<br/>handoff_stage, board.hitl,<br/>progress, cost, deployed_url…")]
        BR_SCENE["Boardroom PixiJS"]
        FAC_SCENE["Factory agent-flow"]
        HITL["HITLPanel<br/>(POST /api/hitl to resolve)"]
    end

    O ==> E1
    O ==> E2
    O ==> E3
    O ==> E4
    O ==> E5
    O ==> E6
    F ==> E1
    F ==> E4
    F ==> E6

    E1 --> HK
    E2 --> HK
    E3 --> HK
    E4 --> HK
    E5 --> HK
    E6 --> HK
    HK --> ST
    ST --> BR_SCENE
    ST --> FAC_SCENE
    ST --> HITL

    classDef be fill:#dbeafe,stroke:#2563eb,color:#1f2937
    classDef fac fill:#d1fae5,stroke:#059669,color:#1f2937
    classDef wire fill:#fce7f3,stroke:#be185d,color:#1f2937
    classDef fe fill:#fef3c7,stroke:#d97706,color:#1f2937
    class BE,O be
    class F fac
    class WIRE,E1,E2,E3,E4,E5,E6 wire
    class FE,HK,ST,BR_SCENE,FAC_SCENE,HITL fe
```

---

## 9. Boardroom cast & delegation graph

```mermaid
flowchart LR
    CEO(("👔 Theo<br/>CEO coordinator"))

    subgraph ROOM["Boardroom roster"]
        direction TB
        DS["📋 data_structurer"]
        subgraph MA_GROUP["🔍 market_analyst"]
            direction TB
            MA["market_analyst<br/>emits MarketAnalysis"]
            MR["market_researcher<br/>+ google_search"]
            MA -. AgentTool .-> MR
        end
        BD["🎨 Juno · brand_designer"]
        BP["📈 business_planner"]
        YA["✒️ Yara · strategist"]
        CT["🛠 Sam · cto"]
        RV["🧐 reviewer"]
    end

    SEND[/"send_back_with_notes"/]
    SHIP[/"start_factory"/]

    CEO --> DS
    CEO --> MA
    CEO --> BD
    CEO --> BP
    CEO --> YA
    CEO --> CT
    CEO --> RV
    CEO --> SEND
    CEO ==> SHIP

    DS -. strategy_board .-> YA
    MA -. market_analysis .-> YA
    BD -. brand .-> YA
    BP -. business_plan .-> YA
    YA -. lean_canvas .-> CT
    CT -. build_plan .-> RV
    RV -. send_back .-> CEO
    RV -. approved .-> SHIP

    classDef ceo fill:#dbeafe,stroke:#2563eb,stroke-width:3px,color:#1f2937
    classDef role fill:#fef3c7,stroke:#d97706,color:#1f2937
    classDef tool fill:#ede9fe,stroke:#7c3aed,color:#1f2937
    class CEO ceo
    class DS,MA,MR,BD,BP,YA,CT,RV role
    class SEND,SHIP tool
```

> **Why the nested AgentTool on market_analyst?** Gemini refuses `output_schema` on any agent that also binds `google_search`. Splitting the role into a *researcher* (tools, prose out) and an *analyst* (no tools, structured JSON out) lets both constraints coexist. Same delegator pattern, one level deeper.

---

## 10. Where things run

```mermaid
flowchart TB
    subgraph LOCAL["💻 Your laptop (make dev)"]
        direction LR
        ORCH_P["Orchestrator :8000"]
        FAC_P["Factory :8888"]
        FE_P["Frontend :3000"]
    end

    subgraph MODELS["🤖 Model providers"]
        direction LR
        LM["LM Studio :1234<br/>cheap dev"]
        GEM["Gemini API<br/>make demo"]
        ANT["Anthropic API<br/>make demo"]
    end

    subgraph CLOUD["☁️ When you ship"]
        direction LR
        GH_C["GitHub"]
        V_C["Vercel"]
        NEON["Neon Postgres"]
        AIG["Vercel AI Gateway"]
        STR["Stripe"]
    end

    ORCH_P --> GEM
    ORCH_P --> LM
    FAC_P --> ANT
    FAC_P --> LM
    FE_P --> ORCH_P
    FE_P --> FAC_P
    FAC_P ==> GH_C
    FAC_P ==> V_C
    V_C -. Marketplace .-> NEON
    V_C -. Marketplace .-> AIG
    V_C -. per-project .-> STR

    classDef local fill:#fef3c7,stroke:#d97706,color:#1f2937
    classDef model fill:#ede9fe,stroke:#7c3aed,color:#1f2937
    classDef cloud fill:#dcfce7,stroke:#15803d,color:#1f2937
    class LOCAL,ORCH_P,FAC_P,FE_P local
    class MODELS,LM,GEM,ANT model
    class CLOUD,GH_C,V_C,NEON,AIG,STR cloud
```

---

## Ports, endpoints, protocols (reference table)

| Service              | Port   | Endpoint                  | Protocol                    |
| -------------------- | ------ | ------------------------- | --------------------------- |
| Orchestrator         | `8000` | `POST /orchestrator`      | AG-UI over SSE              |
| Orchestrator         | `8000` | `GET /health?deep=true`   | JSON                        |
| Factory              | `8888` | `POST /factory`           | AG-UI over SSE              |
| Factory              | `8888` | `GET /health?deep=true`   | JSON                        |
| Frontend             | `3000` | `/`                       | Next.js HTML                |
| Frontend             | `3000` | `/api/copilotkit/*`       | SSE proxy → orchestrator    |
| Frontend             | `3000` | `/api/ag-ui-log`          | JSON POST                   |
| Agent-Flow (dev viz) | `3001` | `/`                       | WS / HTTP                   |
| LM Studio (dev)      | `1234` | `/v1/*`                   | OpenAI-compatible           |

---

## Tech stack reference

| Layer        | Stack                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| Orchestrator | `google-adk` · `ag-ui-adk` · `ag-ui-protocol` · `litellm` · FastAPI · Uvicorn                |
| Factory      | `claude-agent-sdk` · vendored Caveman plugin · built-in MCP tools              |
| Frontend     | Next.js 16 · React 19 · PixiJS 8 · `@pixi/react` · CopilotKit · Tailwind 4                   |
| Protocol     | AG-UI (`RUN_STARTED`, `STATE_DELTA`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `RUN_FINISHED`)        |
| External     | Anthropic API · Gemini API · LM Studio (dev) · GitHub · Vercel · Neon · Stripe · AI Gateway  |
