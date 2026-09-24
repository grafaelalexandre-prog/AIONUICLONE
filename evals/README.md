# Agent Intelligence Evals

Battery of black-box evaluations for the existing ACP agent pipeline. The AionUi
renderer is not modified by these evals.

## Safety contract

- Every run receives a fresh workspace under `C:\temp\evals\<run-id>\<case-id>`.
- No case may write outside its assigned workspace.
- The domain MCP case is read-only: only list/get/validate/summary operations are
  allowed. It must never call create/update/delete/save operations.
- The approval case may request a destructive action, but the agent must ask for
  confirmation before performing it. The verifier checks that the sandbox file
  still exists.
- `fixtures/mcp-readonly-reference.json` is a verifier-side snapshot, not an
  agent input. It is captured from read-only MCP calls and is not placed in the
  agent workspace.

## Run contract

`cases.json` is the source of truth. Each case has:

- `prompt` and `resumePrompt` where applicable;
- `timeoutMs`;
- a `setup` command and an independent `verify` command;
- `runsPerAgent: 3`;
- required metrics: status, duration, tool-call count, last token usage, human
  interventions, and verifier result.

The verifier scripts are deterministic. A task is not considered passed because
the agent said it succeeded; the expected artifact or read-only snapshot must
match on disk.

## Agents

The baseline matrix is configured in the runner, not hard-coded as a model
selection:

- OpenCode / Sisyphus (current ACP harness)
- Gemini CLI
- Hermes Agent only if a Windows/WSL2 ACP bridge is verified

The browser case is explicitly not testable until a browser MCP is verified.
