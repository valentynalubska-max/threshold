import json
import os
from http.server import BaseHTTPRequestHandler

import anthropic


SYSTEM_PROMPT = """You are a specialist in Ukrainian vernacular architecture, 
specifically the traditional khata (хата) dwelling of Podillia and surrounding regions.

You will receive a passage of text (in Ukrainian or English) about vernacular architecture.
Your task is to identify architectural terms and concepts, then return enriched annotations.

Return ONLY valid JSON in this exact format — no preamble, no markdown:
{
  "enriched": [
    {
      "term": "the original term as it appears in the text",
      "start": <character index where term starts>,
      "end": <character index where term ends>,
      "annotation": "concise cultural/architectural explanation (1-2 sentences max)",
      "category": "one of: material | spatial | ritual | structural | decorative"
    }
  ],
  "summary": "one sentence describing the main architectural theme of this passage"
}

Focus on terms like: піч, сволок, покуть, долівка, побілка, сіни, комин, розпис, хата, 
лавка, груба, опічок, підпічок, припічок, рушник, вишивка, мазанка, and related terms.
If no relevant terms are found, return {"enriched": [], "summary": "No architectural terms identified."}
"""


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            text = body.get("text", "").strip()

            if not text:
                self._json(400, {"error": "text is required"})
                return

            if len(text) > 3000:
                self._json(400, {"error": "text too long (max 3000 characters)"})
                return

            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                self._json(500, {"error": "ANTHROPIC_API_KEY not configured"})
                return

            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text}],
            )

            raw = message.content[0].text.strip()
            # Strip any accidental markdown fences
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            result = json.loads(raw)
            self._json(200, result)

        except json.JSONDecodeError as e:
            self._json(500, {"error": f"Failed to parse model response: {e}"})
        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, code, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, *args):
        pass
