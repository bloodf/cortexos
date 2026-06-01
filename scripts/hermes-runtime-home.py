#!/usr/bin/env python3
"""Create a temporary Hermes home with a run-specific fallback model."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import sys
import tempfile


def strip_top_level_block(text: str, key: str) -> list[str]:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    prefix = f"{key}:"
    while i < len(lines):
        if lines[i] == prefix:
            i += 1
            while i < len(lines) and (not lines[i].strip() or lines[i].startswith(" ")):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return out


def model_block_end(lines: list[str]) -> int:
    if not lines or lines[0] != "model:":
        return 0
    i = 1
    while i < len(lines) and (not lines[i].strip() or lines[i].startswith(" ")):
        i += 1
    return i


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: hermes-runtime-home.py SOURCE_HOME FALLBACK_MODEL", file=sys.stderr)
        return 2

    source = Path(sys.argv[1]).resolve()
    fallback_model = sys.argv[2].strip()
    if not source.is_dir() or not fallback_model:
        print(source, end="")
        return 0

    fallback_base_url = os.environ.get("HERMES_FALLBACK_BASE_URL", "http://127.0.0.1:11434/v1")
    tmp = Path(tempfile.mkdtemp(prefix=f"hermes-paperclip-{source.name}-"))

    for child in source.iterdir():
        target = tmp / child.name
        if child.name == "config.yaml":
            continue
        os.symlink(child, target, target_is_directory=child.is_dir())

    config_path = source / "config.yaml"
    text = config_path.read_text(encoding="utf-8")
    lines = strip_top_level_block(text, "fallback_providers")
    lines = strip_top_level_block("\n".join(lines), "fallback_model")
    insert_at = model_block_end(lines)
    fallback_block = [
        "fallback_providers:",
        "  - provider: custom",
        f"    model: {fallback_model}",
        f"    base_url: {fallback_base_url}",
        "    key_env: NINEROUTER_API_KEY",
    ]
    final_lines = [*lines[:insert_at], *fallback_block, *lines[insert_at:]]
    (tmp / "config.yaml").write_text("\n".join(final_lines) + "\n", encoding="utf-8")
    print(tmp, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
