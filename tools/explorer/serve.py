#!/usr/bin/env python3
"""Serve the overlap explorer and pipeline data from the repo root.

Usage (from repository root):
    python tools/explorer/serve.py
    python tools/explorer/serve.py --port 8765

Then open http://127.0.0.1:8765/tools/explorer/
"""

from __future__ import annotations

import argparse
import http.server
import socketserver
import webbrowser
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def end_headers(self) -> None:
        # Allow ES modules when opening from localhost
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve SLR overlap explorer")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser tab")
    args = parser.parse_args()

    url = f"http://127.0.0.1:{args.port}/tools/explorer/"
    with socketserver.TCPServer(("127.0.0.1", args.port), Handler) as httpd:
        print(f"Serving repo root: {REPO_ROOT}")
        print(f"Explorer: {url}")
        print("Press Ctrl+C to stop.")
        if not args.no_open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
