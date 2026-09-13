from __future__ import annotations

import argparse
import functools
import hmac
import http.server
import json
import os
import secrets
import socket
import socketserver
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript"}

    def do_GET(self) -> None:
        if urllib.parse.urlsplit(self.path).path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

    def send_head(self):
        requested = Path(self.translate_path(self.path)).resolve()
        if not requested.is_relative_to(ROOT) or requested.name == "server.pid" or requested == getattr(self.server, "state_file", None) or any(part.startswith(".") for part in requested.relative_to(ROOT).parts):
            self.send_error(403)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(403, "Directory listings are disabled")
        return None

    def end_headers(self) -> None:
        # Every package version uses the same local origin. Avoid mixing a new
        # HTML entry point with JavaScript cached from a previous demo build.
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Sunny-Town-Server", "1")
        super().end_headers()

    def do_POST(self) -> None:
        token = getattr(self.server, "shutdown_token", "")
        supplied = self.headers.get("X-Sunny-Town-Token", "")
        if self.path != "/__sunny_town__/shutdown" or not token or not hmac.compare_digest(token, supplied):
            self.send_error(403)
            return
        self.send_response(204)
        self.end_headers()
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, format: str, *args: object) -> None:
        pass


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = os.name != "nt"
    daemon_threads = True

    def server_bind(self) -> None:
        if os.name == "nt":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def stop_server(state_file: Path) -> None:
    if not state_file.exists():
        print("No running Sunny Town Story server was recorded for this folder.")
        return
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
        port = int(state["port"])
        token = str(state["token"])
        if not 1 <= port <= 65535 or len(token) != 64:
            raise ValueError("Invalid server state")
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/__sunny_town__/shutdown",
            data=b"", headers={"X-Sunny-Town-Token": token}, method="POST",
        )
        with urllib.request.urlopen(request, timeout=3) as response:
            if response.status != 204:
                raise ValueError("This is not the recorded game server")
        print("Sunny Town Story server stopped.")
    except (ValueError, KeyError, TypeError, urllib.error.URLError) as error:
        raise SystemExit(f"Could not contact this folder's game server: {error}. No process was killed.") from error


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve Sunny Town Story.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open-browser", action="store_true")
    parser.add_argument("--state-file", type=Path)
    parser.add_argument("--stop", action="store_true")
    args = parser.parse_args()
    state_file = args.state_file or ROOT / "server.pid"
    if args.stop:
        stop_server(state_file)
        return

    handler = functools.partial(QuietHandler, directory=str(ROOT))
    try:
        with ReusableThreadingTCPServer((args.host, args.port), handler) as server:
            port = server.server_address[1]
            server.shutdown_token = secrets.token_hex(32) if args.state_file else ""
            server.state_file = state_file.resolve() if args.state_file else None
            url = f"http://{args.host}:{port}/"
            if args.state_file:
                state_file.write_text(json.dumps({"pid": os.getpid(), "port": port, "token": server.shutdown_token}), encoding="utf-8")
            print(f"Sunny Town Story is live at {url}", flush=True)
            if args.open_browser:
                webbrowser.open(url)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
            finally:
                if args.state_file and state_file.exists():
                    try:
                        state = json.loads(state_file.read_text(encoding="utf-8"))
                        if state.get("token") == server.shutdown_token:
                            state_file.unlink()
                    except (ValueError, OSError):
                        pass
    except OSError as error:
        raise SystemExit(f"Unable to start the game on {args.host}:{args.port}: {error}. Close the existing server or select another --port.") from error


if __name__ == "__main__":
    main()
