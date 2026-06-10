import json
import os
from http.server import BaseHTTPRequestHandler

import anthropic


def build_system_prompt(rules):
    rules_text = ""
    for r in rules:
        page = f"p.{r['page_number']}" if r.get('page_number') else r.get('source_ref', '')
        rules_text += f"- [{r['id']}] {r['subject']} — {r['relation']} — {r['object']} | \"{r['evidence']}\" | {page}\n"

    return f"""You are a rewriter for Ukrainian vernacular architecture descriptions.

You will receive a short English text describing elements of a Ukrainian khata interior.
Rewrite the text by expanding each element using ONLY the rules provided below.
All output must be in clean English prose.
When using a rule, extract the meaning from the evidence sentence and object field —
do not copy Ukrainian or Russian words directly into the output unless they are
proper architectural terms with no English equivalent (e.g. pich, svolok, dolivka).
Translate and paraphrase rule content naturally into English.
Do not add any knowledge not present in the rules. Do not invent details.
Keep the sentence structure close to the original — expand inline, do not restructure.

RULES (human-validated from B4 Masnenko 2012):
{rules_text}

Return ONLY valid JSON, no markdown, no preamble:
{{
  "enriched_text": "the full rewritten sentence with expansions inline",
  "additions": [
    {{
      "phrase": "exact phrase you added (not in the original text)",
      "rule_id": "the rule ID this came from e.g. REV045",
      "source_ref": "the source_ref field from the rule",
      "page_number": 38
    }}
  ]
}}

Rules:
- Every addition must map to exactly one rule entry above
- If a term in the input has no matching rule, leave it unexpanded
- additions array contains only NEW phrases you added, not original words
- page_number should be null if not available
- If nothing can be expanded, return the original text unchanged with empty additions array"""


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
            rules = body.get("rules", [])

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
            system = build_system_prompt(rules)

            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": f"Rewrite this text using the rules:\n\n{text}"}],
            )

            block = message.content[0]
            raw = (block.text if hasattr(block, "text") else "").strip()
            if "```" in raw:
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else parts[0]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            result = json.loads(raw)
            self._json(200, result)

        except json.JSONDecodeError as e:
            self._json(500, {"error": f"Model response parse error: {e}"})
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
