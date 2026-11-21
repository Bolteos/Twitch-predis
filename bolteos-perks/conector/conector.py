import json
import secrets
import sys
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ORIGIN = "https://bolteos.github.io"
PAGE = ORIGIN + "/Twitch-predis/bolteos-perks/"
PORT = 17842
home = Path(__file__).resolve().parent
config = home / "sala.json"
perks = json.loads((home / "perks.json").read_text(encoding="utf8"))
if config.exists():
    saved = json.loads(config.read_text(encoding="utf8"))
else:
    saved = {"room": secrets.token_hex(16), "settings": {}}
    config.write_text(json.dumps(saved), encoding="utf8")
event = {}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, code, value):
        data = json.dumps(value).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.reply(200, {})

    def handle_api(self):
        global event
        url = urlsplit(self.path)
        host = self.headers.get("Host")
        if host != f"127.0.0.1:{PORT}" or self.headers.get("Origin") not in (None, ORIGIN):
            return self.reply(403, {})
        if parse_qs(url.query).get("room") != [saved["room"]]:
            return self.reply(403, {})
        if self.command == "GET" and url.path == "/api/state":
            return self.reply(200, dict(event, settings=saved["settings"]))
        body = {}
        if self.command == "POST":
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= 4096:
                return self.reply(400, {})
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                return self.reply(400, {})
        if self.command == "POST" and url.path == "/api/settings":
            saved["settings"] = body
            tmp = config.with_suffix(".tmp")
            tmp.write_text(json.dumps(saved), encoding="utf8")
            tmp.replace(config)
            return self.reply(200, {})
        if (self.command, url.path) not in (("POST", "/api/control"), ("GET", "/api/trigger")):
            return self.reply(404, {})
        action = body.get("action", "deal")
        settings = saved["settings"]
        pool = [p["id"] for p in perks if p["role"] == settings.get("role","survivor")]
        if action not in ("deal", "hide") or len(pool)<4:
            return self.reply(400, {})
        style = settings.get("animation", "classic")
        if style == "random":
            style = secrets.choice(["classic","fan","cascade","orbit"])
        event = dict(settings, action=action, style=style, at=int(time.time()*1000),
                     id=secrets.token_hex(16), ids=secrets.SystemRandom().sample(pool,4) if action=="deal" else [])
        self.reply(200,event)

    def do_GET(self):
        try:
            self.handle_api()
        except (ValueError, TypeError):
            self.reply(400, {})
    do_POST = do_GET

if __name__ == "__main__":
    with HTTPServer(("127.0.0.1", PORT), Handler) as server:
        print("Conector activo. Cierra esta ventana al terminar el directo.",flush=True)
        webbrowser.open(PAGE+"?directo=1&room="+saved["room"])
        server.serve_forever()
