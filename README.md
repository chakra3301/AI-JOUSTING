# Jousting ⚔

[![CI](https://github.com/chakra3301/AI-JOUSTING/actions/workflows/ci.yml/badge.svg)](https://github.com/chakra3301/AI-JOUSTING/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/jousting.svg)](https://www.npmjs.com/package/jousting)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org/)

**AI agents charge at each other in structured passes. One fires a payload (the lance), the other counters, a neutral Herald scores each exchange, and a winner is declared.**

🔗 **[Live site →](https://chakra3301.github.io/AI-JOUSTING/)**

## What is this

Jousting is a framework for *adversarial multi-agent reasoning*. Instead of asking one model for an answer, you stage a structured duel: two agents take turns charging and countering over a fixed number of **passes**, a third agent — the **Herald** — scores every exchange and, at the end, synthesizes a balanced verdict and declares a winner.

The metaphor is a medieval joust. Each pass is one charge down the tiltyard. A clean argument is a **direct hit**; a partial point is **glancing**; a whiff is a **miss**; a fatal, unanswerable blow is an **unseat** — and ends the joust early. The result is sharper than a single prompt because each side is forced to attack and defend specific claims.

## Install

```bash
npm install -g jousting
# or run without installing
npx jousting init
```

Requires **Node.js 20+**.

## Quickstart

Three commands and you're running:

```bash
export ANTHROPIC_API_KEY=sk-...      # 1. set your key
npx jousting init --topic "Should we rewrite this in Rust?"   # 2. scaffold config
npx jousting joust                   # 3. run the joust
```

Every joust is saved as a `.joust` replay file you can replay or re-score later:

```bash
jousting replay should-we-rewrite-this-in-rust-AbC123.joust
```

## Joust modes

Each mode defines how the two agents and the Herald behave.

| Mode        | Agent A           | Agent B               | Herald does                              |
|-------------|-------------------|-----------------------|------------------------------------------|
| `debate`    | Argues **for**    | Argues **against**    | Scores rebuttals; declares the winner    |
| `redteam`   | **Attacker**      | **Defender**          | Scores exploits vs. mitigations          |
| `review`    | **Author**        | **Critic**            | Scores critiques vs. defenses            |
| `synthesis` | Supporting evidence | Contradicting evidence | Synthesizes a balanced view            |
| `plan`      | **Planner** (iterates) | **Stress-tester** | Evaluates the final, adapted plan        |

Set the mode in `jousting.toml` or override per-run with `--mode`.

## Config reference

A full annotated `jousting.toml`:

```toml
[tiltyard]
topic     = "Should we rewrite this in Rust?"   # the problem/question
passes    = 5                                    # number of exchange rounds
mode      = "debate"                             # debate|redteam|review|synthesis|plan
save      = true                                 # auto-save a .joust replay file

[agent_a]
name        = "Lancer"
model       = "claude-sonnet-4-6"
provider    = "anthropic"                        # anthropic|openai|gemini|groq|openrouter|ollama
lance_style = "aggressive"                       # aggressive|methodical|socratic
persona     = "senior engineer who loves Rust"

[agent_b]
name        = "Paladin"
model       = "claude-sonnet-4-6"
provider    = "anthropic"
lance_style = "methodical"
persona     = "pragmatic CTO who ships in Go"

[herald]
model      = "claude-sonnet-4-6"
provider   = "anthropic"
scoring    = "strict"                            # strict|lenient|narrative
synthesize = true                                # produce a final synthesis
```

**Lance styles** shape how an agent fights: `aggressive` (forceful, leads with the strongest blow), `methodical` (systematic, builds case by case), `socratic` (probes assumptions with sharp questions).

**Scoring styles** shape the Herald: `strict` (reserves direct hits and unseats), `lenient` (rewards good points generously), `narrative` (scores the momentum and story of the duel).

### Commands

```bash
jousting init          # scaffold a jousting.toml (prompts for topic interactively)
  --topic "..."  --mode <mode>  --force

jousting joust         # run a single joust (reads ./jousting.toml by default)
  --config <path>  --topic "..."  --passes <n>  --mode <mode>
  --dry-run            # print resolved config + prompts, make no API calls
  --no-save            # don't write a .joust file

jousting tournament    # run a bracket (requires a [tournament] block)
  --config <path>  --topic "..."  --passes <n>  --mode <mode>

jousting replay <file.joust>
  --speed <1|2|3>      # 1 slow, 2 medium, 3 instant

jousting herald <file.joust>   # re-score a saved joust
  --model <model>  --scoring <mode>  --save
```

Add `--no-splash` (or set `JOUSTING_NO_SPLASH=1`) to skip the startup splash for CI/pipes.

## The `.joust` format

Every joust is saved as JSON with a `.joust` extension, named `{topic-slug}-{id}.joust`:

```json
{
  "id": "abc123",
  "version": "1.0",
  "created_at": "2026-06-22T12:00:00.000Z",
  "config": { "...full config object..." },
  "passes": [
    {
      "pass": 1,
      "a": { "agent": "Lancer", "payload": "..." },
      "b": { "agent": "Paladin", "payload": "..." },
      "score": {
        "pass": 1,
        "scores": {
          "a": { "hit": "glancing", "reasoning": "..." },
          "b": { "hit": "direct", "reasoning": "..." }
        },
        "unseat": false,
        "unseated_agent": null,
        "commentary": "Paladin landed a concrete operational counterpoint..."
      }
    }
  ],
  "result": {
    "winner": "Paladin",
    "synthesis": "...",
    "total_hits": { "a": 2, "b": 3 }
  }
}
```

Hit types are `direct` · `glancing` · `miss` · `unseat`. Hit weights (unseat 3, direct 2, glancing 1, miss 0) decide the winner; an unseat ends the joust immediately.

## Tournament mode

Run several agents in a bracket. Add a `[tournament]` block listing the competitors:

```toml
[tournament]
format = "roundrobin"   # roundrobin | elimination

[[tournament.agents]]
name = "Lancer"
model = "claude-sonnet-4-6"
provider = "anthropic"
lance_style = "aggressive"
persona = "Rust maximalist"

[[tournament.agents]]
name = "Paladin"
model = "claude-sonnet-4-6"
provider = "anthropic"
lance_style = "methodical"
persona = "pragmatic Go shipper"

# add as many [[tournament.agents]] as you like
```

Then:

```bash
jousting tournament
```

- **`roundrobin`** — every agent jousts every other; most wins takes the crown.
- **`elimination`** — single-elimination bracket; last knight standing is champion.

The `[tiltyard]` and `[herald]` blocks supply the topic, passes, mode, and judge for every match.

## Providers & auth

Each agent (and the Herald) picks a `provider`. Jousting ships adapters for six:

| `provider`   | SDK / transport                       | Env key              | Notes                                            |
|--------------|---------------------------------------|----------------------|--------------------------------------------------|
| `anthropic`  | `@anthropic-ai/sdk`                   | `ANTHROPIC_API_KEY`  | default                                          |
| `openai`     | `openai`                             | `OPENAI_API_KEY`     |                                                  |
| `gemini`     | `@google/generative-ai`              | `GEMINI_API_KEY`     | optional peer dep                                |
| `groq`       | `groq-sdk`                           | `GROQ_API_KEY`       | optional peer dep                                |
| `openrouter` | `openai` (baseURL override)          | `OPENROUTER_API_KEY` | model strings pass through, e.g. `meta-llama/llama-3-70b` |
| `ollama`     | `fetch` → `/api/chat`                | _none_               | local; respects `OLLAMA_HOST` (default `http://localhost:11434`) |

Keys are read from the environment:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
# ollama needs no key; set OLLAMA_HOST if not on the default port
```

Keep them in a `.env` file and load it with Node's built-in flag — no extra dependency:

```bash
node --env-file=.env $(which jousting) joust
```

### Using your Claude subscription (`--use-subscription`)

If you're logged in with the [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI, you can run Anthropic agents on your **Claude Pro/Max subscription** instead of a metered `ANTHROPIC_API_KEY`:

```bash
claude /login            # once, if you haven't already
npx jousting joust --use-subscription
```

Jousting reads the Claude Code OAuth token from your macOS keychain or `~/.claude/.credentials.json` (or the `CLAUDE_CODE_OAUTH_TOKEN` env var). This applies to every `anthropic` agent and the Herald.

> [!WARNING]
> **Personal use only — this may violate Anthropic's Terms of Service.** Driving a Pro/Max subscription through OAuth outside the official Claude Code client is unsupported and could result in rate-limiting or account action. It is **never** used unless you explicitly pass `--use-subscription`. For anything shared, automated, or production, use a real `ANTHROPIC_API_KEY`. Subscription tokens also expire periodically — run any `claude` command to refresh.

The orchestrator and Herald never import a provider directly — they call `getAdapter(provider)`, which dispatches to the right adapter, all behind a shared `LLMAdapter` interface. Provider SDKs are loaded lazily, so:

- A missing key fails with `Agent '<name>' uses <provider> but <KEY> is not set.`
- A missing optional SDK fails with `Install the <provider> adapter: npm install <package>`.
- An unreachable Ollama fails with `Jousting couldn't reach Ollama at <host>. Is it running?`

`@google/generative-ai` and `groq-sdk` are optional peer dependencies — install them only if you use those providers.

## Contributing

```bash
git clone https://github.com/chakra3301/AI-JOUSTING
cd AI-JOUSTING
npm install
npm run dev -- joust --dry-run    # run from source via tsx
npm run build                     # bundle with tsup
```

The codebase is small and layered: `config/` (load + validate), `adapters/` (LLM providers), `modes/` (the five duel formats), `core/` (orchestrator, agent, herald, tournament), `display/` (TTY rendering), and `commands/` (CLI handlers). PRs welcome — especially new modes and adapters.

## License

MIT
