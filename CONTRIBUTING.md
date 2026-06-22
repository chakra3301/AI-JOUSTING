# Contributing to Jousting ⚔

Thanks for wanting to help! Jousting is a small, layered TypeScript codebase and PRs are welcome — especially **new modes** and **new provider adapters**.

## Getting started

```bash
git clone https://github.com/chakra3301/AI-JOUSTING
cd AI-JOUSTING
npm install
npm run dev -- joust --dry-run    # run from source via tsx, no API calls
```

Before opening a PR, make sure these pass:

```bash
npx tsc --noEmit     # type-check
npm run build        # bundle with tsup
JOUSTING_NO_SPLASH=1 node dist/cli/index.js joust --config examples/debate.toml --dry-run
```

## Project layout

| Directory        | Responsibility                                            |
|------------------|-----------------------------------------------------------|
| `src/config/`    | Load + validate `jousting.toml` (zod schema, smol-toml)   |
| `src/adapters/`  | LLM providers behind a shared `LLMAdapter` interface      |
| `src/modes/`     | The five duel formats                                      |
| `src/core/`      | Orchestrator, agent, herald, tournament                   |
| `src/display/`   | TTY rendering (splash, pass/score/summary views)          |
| `src/commands/`  | CLI command handlers                                       |
| `src/cli/`       | Commander wiring                                           |

## Adding a provider adapter

1. Create `src/adapters/<provider>.ts` implementing the `LLMAdapter` interface
   (`provider` + `complete()`), lazy-loading its SDK via `loadSdk()`.
2. Register it in `src/adapters/index.ts` (`REGISTRY`) with its `keyEnv`.
3. Add the value to the `Provider` union in `src/types/index.ts` and to
   `providerSchema` in `src/config/schema.ts`.
4. Document it in the README provider table.

## Adding a mode

1. Create `src/modes/<mode>.ts` exporting a `ModeModule`
   (`name`, `systemPromptA`, `systemPromptB`, `heraldPrompt`, `firstMoverInstructions`).
2. Register it in `src/modes/index.ts`.
3. Add the value to the `Mode` union and `modeSchema`.
4. Add an example `.toml` under `examples/`.

## Style

- TypeScript strict mode; no `any` unless interfacing with an untyped SDK.
- Keep prompts focused and the display layer pure (no API calls).
- One logical change per PR.

By contributing you agree your work is licensed under the project's MIT license.
