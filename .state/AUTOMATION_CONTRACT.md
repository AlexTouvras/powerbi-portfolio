# Automation contract

> IDE-first workspace for Power BI / Fabric portfolio builds.
> No scheduled Cursor Automations bind here yet — contract defines verify + MCP boundaries.

**Last updated:** 2026-09-02

## Runtime

| Field | Value |
|-------|-------|
| Repo | `AlexTouvras/PowerBI` (local: `projects/PowerBI`) |
| Branch | `main` |
| Primary verify | `powerbi-report-author` validate + Desktop Bridge screenshot when PBIR touched |
| Playbooks | Personal skills: `powerbi-report-planning`, `semantic-model-authoring`, `powerbi-report-design`, `powerbi-report-authoring` |

## Scope (one run = one item)

| Task type | One run produces |
|-----------|------------------|
| New report | One approved page slice or one validate pass |
| Model change | One table/measure/relationship change + DAX smoke |
| Portfolio screenshot | One report's screenshot set |

## Tool allowlist

| Runtime | Allowed | Blocked without AUTH |
|---------|---------|----------------------|
| IDE | Power BI Modeling MCP, terminal, PBIR CLIs | Fabric publish, workspace delete |
| Automation | _(none configured)_ | — |

## Skill allowlist

| Runtime | Skills |
|---------|--------|
| IDE | `semantic-model-authoring`, `powerbi-report-*`, `check-updates`, `fable-method`, `fable-judge`, `project-state` |
| Automation | _(none)_ |

## Read order (before acting)

1. `.state/AUTOMATION_CONTRACT.md` (this file)
2. `.state/CURRENT_TASK.md` + `.state/ARCHITECTURE.md`
3. Report `_brief/report-spec.md` or category README for the active build
4. Matching `docs/architecture/` diagram when flows change

IDE may use ProjectBrain MCP. Do not invent DAX from memory — use Modeling MCP or open TMDL.

## Write order (before exit)

1. Implement surgical diff (PBIP/TMDL/PBIR)
2. Run report author validate; Desktop Bridge reload when visuals touched
3. When that report is finished for the portfolio, `py -3.12 _shared/scripts/capture_showcase.py capture <folder> --pid <pid>` so `screenshots/` is the page canvas
4. Update `.state/CURRENT_TASK.md` with verify output
5. Log new patterns in `.state/ARCHITECTURE.md`

## Out of scope

- Fabric publish / workspace deploy without explicit user AUTH
- "Report done" without observed validate or screenshot artifact
- Long Modeling MCP full refresh on large local models when Desktop UI refresh works

## IDE coexistence

This repo is IDE-primary. If scheduled automations are added later, extend the Automations table and trim skill/tool allowlists for headless runs.
