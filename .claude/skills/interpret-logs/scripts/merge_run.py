#!/usr/bin/env python3
"""Merge a run's JSONL logs into one chronological stream.

Usage:
    python merge_run.py <logs/<thread_id>>
    python merge_run.py --latest        # newest logs/<thread_id>/ under cwd
    python merge_run.py <folder> --filter-boot <boot_id>

Prints one line per event:
    <ts>  <component>  <summary>

Components are normalized to 4-char tags so they line up: ag-ui / orch / adk  / fact.
The <summary> is the wire-event type for ag-ui lines, "<logger>: <message>" for the
Python files. Full records are available in the source files if the summary
isn't enough — this script is for seeing the hand-off structure at a glance.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

COMPONENTS: dict[str, str] = {
    "ag-ui.jsonl": "ag-ui",
    "orchestrator.jsonl": "orch ",
    "adk.jsonl": "adk  ",
    "factory.jsonl": "fact ",
}


def summarize(component: str, record: dict) -> str:
    if component.strip() == "ag-ui":
        event = record.get("event") or {}
        if not isinstance(event, dict):
            return "(malformed event)"
        etype = event.get("type", "?")
        extra_bits: list[str] = []
        if "name" in event:
            extra_bits.append(f"agent={event['name']}")
        if "toolName" in event:
            extra_bits.append(f"tool={event['toolName']}")
        if etype == "STATE_DELTA":
            paths = [op.get("path") for op in event.get("delta", []) if isinstance(op, dict)]
            extra_bits.append("paths=" + ",".join(p for p in paths if p))
        extra = " " + " ".join(extra_bits) if extra_bits else ""
        return f"{etype}{extra}"
    logger = record.get("logger", "?")
    message = record.get("message", "")
    level = record.get("level", "")
    return f"[{level}] {logger}: {message}"


def load_records(folder: Path, boot_filter: str | None) -> list[tuple[str, str, dict]]:
    records: list[tuple[str, str, dict]] = []
    for filename, tag in COMPONENTS.items():
        path = folder / filename
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if boot_filter and rec.get("boot_id") != boot_filter:
                    continue
                ts = rec.get("ts")
                if not ts:
                    continue
                records.append((ts, tag, rec))
    records.sort(key=lambda r: r[0])
    return records


def resolve_folder(args: argparse.Namespace) -> Path:
    if args.folder:
        return Path(args.folder).resolve()
    # --latest: newest logs/<thread_id>/ under cwd, skipping _startup/_idle
    logs_root = Path.cwd() / "logs"
    if not logs_root.exists():
        sys.exit(f"No logs/ directory in {Path.cwd()}. Pass a folder explicitly.")
    candidates = [
        p for p in logs_root.iterdir()
        if p.is_dir() and not p.name.startswith("_")
    ]
    if not candidates:
        sys.exit("No run folders found under logs/.")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", nargs="?", help="Path to logs/<thread_id>/ directory")
    parser.add_argument("--latest", action="store_true", help="Use newest run folder")
    parser.add_argument("--filter-boot", dest="filter_boot", help="Only lines from this boot_id")
    args = parser.parse_args()

    if not args.folder and not args.latest:
        parser.error("Pass a folder, or --latest")

    folder = resolve_folder(args)
    records = load_records(folder, args.filter_boot)
    if not records:
        sys.exit(f"No records found in {folder}")

    print(f"# {folder}  ({len(records)} events)")
    for ts, tag, rec in records:
        print(f"{ts}  {tag}  {summarize(tag, rec)}")


if __name__ == "__main__":
    main()
