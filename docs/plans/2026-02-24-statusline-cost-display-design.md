# StatusLine Cost Display Design

## Overview

Add cost and duration information to the status line display.

## Final Format

```
厂商:GLM | 💰$0.0123 | ⏱45s(2.3s) | 上下文:1% ▓░░░░░░░░░ | 📁code-cli-switch | 🌿master
```

## Fields to Display

| Field | Format | Example |
|-------|--------|---------|
| total_cost_usd | `$` + 4 decimal places | $0.0123 |
| total_duration_ms | Smart conversion | 45s / 1.5m / 2.3h |
| total_api_duration_ms | In parentheses | (2.3s) |

## Time Duration Smart Conversion

| Duration | Display |
|----------|---------|
| < 1 second | `450ms` |
| < 1 minute | `45s` / `2.3s` |
| < 1 hour | `1.5m` |
| >= 1 hour | `2.3h` |

## Placement

After vendor name, before context usage.

## Implementation

1. Add `formatDuration(ms)` function for smart time conversion
2. Add `formatCost(usd)` function for cost formatting
3. Update `bin/statusline.js` to extract `cost` from stdin JSON
4. Update `renderStatusBar()` to include cost and duration display
