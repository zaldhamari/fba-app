"""
Shared Claude client. Falls back gracefully if no API key is set,
or if the monthly spend cap has been reached.

Drop this in at backend/modules/ai_client.py in the fba-backend repo,
replacing the OpenAI version. Every other module imports `chat` / `chat_json`
/ `AI_AVAILABLE` from here and needs ZERO changes — same function names,
same signatures, same exception-driven fallback behavior they already rely on.
"""
import os
import json
import time
from typing import Any

try:
    from anthropic import Anthropic
    _client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    AI_AVAILABLE = bool(os.getenv("ANTHROPIC_API_KEY"))
except Exception:
    _client = None
    AI_AVAILABLE = False

# Fast model for analysis, text, and JSON tasks.
MODEL = "claude-haiku-4-5"
# Creative model for SVG generation, brand design, label/insert generation.
# Sonnet produces substantially richer SVG output and handles large token budgets.
MODEL_CREATIVE = "claude-sonnet-4-6"

# ── Spend guard ──────────────────────────────────────────────────────────────
# In-memory monthly cost tracker — resets on every Railway redeploy/restart.
# This is a SOFT guard only: it makes AI calls degrade gracefully (same
# exception-driven fallback every module already has) before you ever hit
# real money. The HARD ceiling is the monthly spend limit you set in the
# Anthropic Console (Settings > Workspaces > Limits) — that one survives
# restarts and can't be bypassed by a bug here.
MONTHLY_BUDGET_USD = float(os.environ.get("AI_MONTHLY_BUDGET_USD", "60"))
WARN_AT = 0.8

# Claude Haiku 4.5 rates: $1 / $5 per million input/output tokens.
RATE_IN    = 1 / 1_000_000
RATE_OUT   = 5 / 1_000_000
# Claude Sonnet 4.6 rates: $3 / $15 per million input/output tokens.
RATE_IN_S  = 3 / 1_000_000
RATE_OUT_S = 15 / 1_000_000

_month_spend = 0.0
_month_key = time.strftime("%Y-%m")


def _reset_if_new_month() -> None:
    global _month_spend, _month_key
    key = time.strftime("%Y-%m")
    if key != _month_key:
        _month_key = key
        _month_spend = 0.0


def _record_call(input_tokens: int, output_tokens: int, creative: bool = False) -> None:
    global _month_spend
    _reset_if_new_month()
    if creative:
        _month_spend += input_tokens * RATE_IN_S + output_tokens * RATE_OUT_S
    else:
        _month_spend += input_tokens * RATE_IN + output_tokens * RATE_OUT


def is_over_budget() -> bool:
    _reset_if_new_month()
    return _month_spend >= MONTHLY_BUDGET_USD


def is_near_budget() -> bool:
    _reset_if_new_month()
    return _month_spend >= MONTHLY_BUDGET_USD * WARN_AT


def month_spend() -> float:
    _reset_if_new_month()
    return round(_month_spend, 4)


# ── Public API (unchanged signatures) ────────────────────────────────────────

def chat(system: str, user: str, max_tokens: int = 800) -> str:
    """Send a chat completion and return the text response. Uses Haiku — fast and cheap."""
    if not AI_AVAILABLE or _client is None:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    if is_over_budget():
        raise RuntimeError(f"Monthly AI budget (${MONTHLY_BUDGET_USD}) reached for {_month_key}")

    resp = _client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    _record_call(resp.usage.input_tokens, resp.usage.output_tokens, creative=False)
    return resp.content[0].text.strip()


def chat_creative(system: str, user: str, max_tokens: int = 6000) -> str:
    """
    Send a creative/design completion using Sonnet. Use for SVG generation (logos,
    labels, inserts) where Haiku produces thin, generic output. Sonnet generates
    significantly richer SVG structure, uses design vocabulary, and rarely truncates.

    Default max_tokens=6000 — enough for a detailed multi-element SVG logo.
    Bump to 8000+ for complex labels with compliance text.
    """
    if not AI_AVAILABLE or _client is None:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    if is_over_budget():
        raise RuntimeError(f"Monthly AI budget (${MONTHLY_BUDGET_USD}) reached for {_month_key}")

    resp = _client.messages.create(
        model=MODEL_CREATIVE,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    _record_call(resp.usage.input_tokens, resp.usage.output_tokens, creative=True)
    return resp.content[0].text.strip()


def chat_json(system: str, user: str, max_tokens: int = 800) -> Any:
    """Send a chat completion and parse the JSON response. Uses Haiku."""
    system_with_json = system + "\n\nRespond ONLY with valid JSON. No markdown, no explanation."
    raw = chat(system_with_json, user, max_tokens)
    # Strip markdown code fences if present
    raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    return json.loads(raw)


def chat_creative_json(system: str, user: str, max_tokens: int = 6000) -> Any:
    """Send a creative completion and parse the JSON response. Uses Sonnet."""
    system_with_json = system + "\n\nRespond ONLY with valid JSON. No markdown, no explanation."
    raw = chat_creative(system_with_json, user, max_tokens)
    raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    return json.loads(raw)
