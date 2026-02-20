> [← Overview](./0-overview.md) | [Document Index](./0-overview.md#document-index)

## 10. Deferred Decisions

| Item | Rationale | When |
| --- | --- | --- |
| ~~Service layer~~ | ~~Only 1 consumer (MCP) in v0.1.0~~ → **Resolved**: Workflow layer in `src/protocols/workflows/`（Phase 6a） | ✅ Resolved |
| ~~AuditLogger extraction~~ | ~~Currently MCP governance semantics only~~ → **Resolved**: `AuditSink` interface 注入 workflows，`AuditLogger` 實作保留在 `src/agentic/audit/`，CLI 也可注入 | ✅ Resolved |
| ~~CLI framework choice~~ | ~~yargs vs commander vs minimist~~ → **Resolved**: 手動 `switch` routing（零依賴），與 `src/agentic/cli.ts` 模式一致 | ✅ Resolved |
| `./protocols` as standalone npm package | Monorepo split not justified yet → **partially addressed**: OpenClaw plugin 是首個外部 consumer | When more independent consumers exist |
| Skills using programmatic API directly | Skills are markdown → MCP tool calls | When skills framework supports in-process execution |
| ~~OpenClaw integration~~ | ~~ADR-001 defers to Phase 2~~ → **Resolved**: Phase 8 controlled launch | ✅ Resolved |

## 11. Open Decisions

| Decision | Options | Default | When |
| --- | --- | --- | --- |
| Contract registry format | Hardcoded / JSON config file | Hardcoded (Phase 1), config file later | P1 |
| `sign_defi_call` `expectedProtocol` hint | Required / Optional / None | Optional | P3 |
| Policy config file schema | Extend existing / New file | Extend existing `--policy-config` | P2 |
| ~~CLI framework~~ | ~~yargs / commander / minimist~~ | ~~TBD~~ → 手動 switch routing（零依賴） | ✅ Resolved |
| ~~`dry-run` output format~~ | ~~JSON / human-readable / both~~ | ~~TBD~~ → JSON pretty-print（預設） | ✅ Resolved |
| `./cli` subpath export | Export CLI commands for testing / Not export | Not export (internal) | Phase 6c |
| ~~`encode` subcommand scope~~ | ~~All registered protocols / Curated subset~~ | ~~All registered protocols via Action Catalog~~ | ✅ Resolved |
| ~~`--output` format flag~~ | ~~`json` / `human` / `raw`~~ | ~~`json`（default）~~ → `json`/`human`/`raw` implemented | ✅ Resolved |
| ~~Interactive confirmation~~ | ~~TTY-only / `--yes` flag / always~~ | ~~TTY-only with `--yes` override~~ → TTY-only + `--yes` | ✅ Resolved |
| Multi-chain RPC URL format | Comma-separated `k=v` / JSON file / env-per-chain | Comma-separated `chainId=url` string | Phase 10 |
