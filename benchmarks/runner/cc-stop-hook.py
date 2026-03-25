#!/usr/bin/env python3
"""
cc-stop-hook.py — Claude Code Stop hook for benchmark token capture.

Invoked automatically by the .claude/settings.json Stop hook written into the
benchmark worktree by generate.ts --mode prompt.  Reads the CC session
transcript, sums token usage across all turns (including subagents), and
writes generation-meta.json to the result directory so that save-result.sh
can pick it up.

Usage (called by the Claude Code hook system, never directly):
  python3 cc-stop-hook.py <result-dir>

Stdin: JSON object  { transcript_path, session_id, cwd, hook_event_name, ... }
"""
import json
import os
import sys
import time
from datetime import datetime, timezone


def sum_tokens(path: str) -> tuple[int, int, int]:
    """Return (input_tokens, output_tokens, turns) parsed from a JSONL transcript."""
    inp = out = turns = 0
    try:
        with open(path) as fh:
            for raw in fh:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    rec = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                msg = rec.get("message")
                if not isinstance(msg, dict):
                    continue
                if msg.get("role") != "assistant":
                    continue
                usage = msg.get("usage")
                if not usage:
                    continue
                inp += (
                    (usage.get("input_tokens") or 0)
                    + (usage.get("cache_creation_input_tokens") or 0)
                    + (usage.get("cache_read_input_tokens") or 0)
                )
                out += usage.get("output_tokens") or 0
                turns += 1
    except OSError as exc:
        print(f"[cc-stop-hook] Warning: cannot read {path}: {exc}", file=sys.stderr)
    return inp, out, turns


def first_timestamp(path: str) -> float:
    """Return the Unix timestamp of the first timestamped record, or now."""
    try:
        with open(path) as fh:
            for raw in fh:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    rec = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                ts = rec.get("timestamp")
                if ts:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    return dt.timestamp()
    except OSError:
        pass
    return time.time()


def main() -> None:
    if len(sys.argv) < 2:
        print("[cc-stop-hook] Error: result-dir argument required", file=sys.stderr)
        sys.exit(1)

    result_dir = sys.argv[1]

    hook_input: dict = {}
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, OSError):
        pass

    transcript_path: str = hook_input.get("transcript_path", "")
    if not transcript_path or not os.path.exists(transcript_path):
        print(
            f"[cc-stop-hook] Warning: transcript not found at {transcript_path!r}",
            file=sys.stderr,
        )
        sys.exit(0)

    # Main session tokens
    total_inp, total_out, total_turns = sum_tokens(transcript_path)

    # Subagent tokens — stored at <transcript_dir>/<session_id>/subagents/*.jsonl
    session_id = os.path.splitext(os.path.basename(transcript_path))[0]
    subagents_dir = os.path.join(os.path.dirname(transcript_path), session_id, "subagents")
    if os.path.isdir(subagents_dir):
        for fname in sorted(os.listdir(subagents_dir)):
            if fname.endswith(".jsonl"):
                si, so, _ = sum_tokens(os.path.join(subagents_dir, fname))
                total_inp += si
                total_out += so

    # Elapsed time: first timestamped record → now
    start_ts = first_timestamp(transcript_path)
    time_seconds = round(time.time() - start_ts, 1)

    meta = {
        "model": hook_input.get("model", ""),
        "provider": "anthropic",
        "inputTokens": total_inp,
        "outputTokens": total_out,
        "turns": total_turns,
        "retries": total_turns,
        "exitSubtype": "success",
        "timeSeconds": time_seconds,
    }

    out_path = os.path.join(result_dir, "generation-meta.json")
    try:
        os.makedirs(result_dir, exist_ok=True)
        with open(out_path, "w") as fh:
            json.dump(meta, fh, indent=2)
            fh.write("\n")
        print(
            f"[cc-stop-hook] Wrote {out_path} — "
            f"in={total_inp} out={total_out} time={time_seconds}s turns={total_turns}",
            flush=True,
        )
    except OSError as exc:
        print(f"[cc-stop-hook] Error writing {out_path}: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
