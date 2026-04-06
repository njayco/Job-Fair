# Career-Ops

An AI-powered job search pipeline and automation toolkit built on Claude Code. It automates job discovery, evaluation, CV tailoring, and application tracking.

## Architecture

- **Languages**: Node.js (automation scripts), Go (terminal dashboard)
- **Package Manager**: npm (Node.js), Go Modules (dashboard)
- **Build**: Go binary compiled to `career-ops-dashboard`

## Project Structure

- `dashboard/` - Go TUI dashboard (Bubble Tea + Lipgloss, Catppuccin theme)
- `modes/` - Claude Code skill markdown files for different commands
- `batch/` - Parallel processing orchestrator scripts
- `config/` - Profile and portal configuration templates (YAML)
- `templates/` - HTML/CSS templates for CV generation
- `data/` - Application tracker (`applications.md`)
- `reports/` - Evaluation reports (markdown)
- `output/` - Generated PDF CVs (gitignored)
- `examples/` - Sample files and CV example

## Key Files

- `generate-pdf.mjs` - Playwright-based PDF generator
- `merge-tracker.mjs` - Merge application tracker data
- `verify-pipeline.mjs` - Pipeline integrity checker
- `normalize-statuses.mjs` - Status normalization
- `dedup-tracker.mjs` - Deduplication utility
- `run-dashboard.sh` - Startup script (builds + runs dashboard)
- `career-ops-dashboard` - Compiled Go dashboard binary

## Running

The dashboard workflow runs `bash run-dashboard.sh`, which builds the Go binary if needed and launches the TUI.

## npm Scripts

- `npm run verify` - Check pipeline integrity
- `npm run normalize` - Normalize application statuses
- `npm run dedup` - Deduplicate tracker entries
- `npm run merge` - Merge tracker data
- `npm run pdf` - Generate PDF CV
- `npm run sync-check` - CV sync check
