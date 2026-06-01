#!/usr/bin/env python3
"""Filter benign Hermes shutdown noise before Paperclip parses stderr."""

from __future__ import annotations

import sys


def main() -> int:
    suppressing = False
    for line in sys.stdin:
        if line.startswith("Exception ignored in: <function BaseSubprocessTransport.__del__"):
            suppressing = True
            continue
        if suppressing:
            if "RuntimeError: Event loop is closed" in line:
                suppressing = False
            continue
        sys.stderr.write(line)
        sys.stderr.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
