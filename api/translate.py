import json
import os
from http.server import BaseHTTPRequestHandler

import anthropic


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            items = body.get("items", [])

            if not items:
                self._json(200, {"translations": []})
                return

            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                self._json(500, {"error": "ANTHROPIC_API_KEY not configured"})
                return

            # Build compact pipe-delimited batch request
            lines = []
            for item in items:
                lines.append(f"{item['id']}|evidence|{item.get('evidence', '')}")
                if item.get("object_uk"):
                    lines.append(f"{item['id']}|object|{item['object_uk']}")

            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=(
                    "You are a precise translator from Ukrainian to English specializing in "
                    "traditional Ukrainian vernacular architecture (khata, pich, svolok, dolivka, etc.). "
                    "Translate the text after the last | in each line accurately and concisely. "
                    "Preserve untranslatable architectural terms (e.g. pich, svolok, dolivka, pokut). "
                    "Return ONLY the translated lines in the exact same pipe-delimited format, "
                    "one per line, no preamble or explanation."
                ),
                messages=[{
                    "role": "user",
                    "content": "Translate the text after the last | in each line:\n\n" + "\n".join(lines),
                }],
            )

            raw_lines = message.content[0].text.strip().split("\n")

            # Parse pipe-delimited response
            result = {}
            for line in raw_lines:
                parts = line.split("|", 2)
                if len(parts) == 3:
                    id_, type_, text = parts[0].strip(), parts[1].strip(), parts[2].strip()
                    if id_ not in result:
                        result[id_] = {}
                    result[id_][type_] = text

            translations = [
                {
                    "id": item["id"],
                    "evidence_en": result.get(item["id"], {}).get("evidence", ""),
                    "object_en": result.get(item["id"], {}).get("object", "") if item.get("object_uk") else "",
                }
                for item in items
            ]

            self._json(200, {"translations": translations})

        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, *args):
        pass
