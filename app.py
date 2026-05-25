from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Neon Grid showcase.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with ReusableThreadingTCPServer((args.host, args.port), handler) as server:
        print(f"Neon Grid Command Center is live at http://{args.host}:{args.port}/")
        server.serve_forever()


if __name__ == "__main__":
    main()
