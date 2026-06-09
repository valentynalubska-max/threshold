import json
import os
from http.server import BaseHTTPRequestHandler

import anthropic

# ── VALIDATED TRUE TRIPLES FROM A3.PDF ───────────────────────────────────────
# Only KEPT triples with human_tag = TRUE
VALIDATED_KB = """
VALIDATED KNOWLEDGE BASE — Ukrainian Vernacular Architecture (B4 Masnenko 2012)
All entries below are human-validated as TRUE from the ПОРІГ extraction pipeline.

ПICH (Stove):
- ПІЧ — MADE_OF — глина та цегла | "Піч виліплена з глини, обмащена й побілена крейдою." p.32
- ПІЧ — DECORATED_WITH — розпис | "Піч прикрашена квітковим розписом з геометричними елементами." p.38
- ПІЧ — DECORATED_WITH — орнаментальне розмалювання | "В українській хаті пильну увагу приділяли орнаментальному розмалюванню печі." 
- ПІЧ — IS_ASSOCIATED_WITH — центр житла | "Піч (раніше відкрите вогнище) була центром житла. Вся інша площа – своєрідною добудовою до неї."
- ПІЧ — IS_ASSOCIATED_WITH — KHATA_HOUSE | "При вході в хату стоїть піч."
- ПІЧ — ADJACENT_TO — TABLE | "Охоплює піл (місце для спання), який прилягає до печі, та стіл." p.62
- ПІЧ — ADJACENT_TO — BENCH_LAVA | "Біля печі ставили невелику лавку." p.128
- ПІЧ — OPPOSITE — BENCH_LAVA | "Навпроти печі, на лаві." p.55

СВОЛОК (Main ceiling beam):
- СВОЛОК — IS_COSMOLOGICALLY_IDENTIFIED_AS — небесна ясная зоря | "Чумацький Шлях, а покуть – небесна ясная зоря." p.4
- СВОЛОК — MADE_OF — дерев'яних балок | "Перекриття робили з дерев'яних балок." p.151
- СВОЛОК — IS_ANIMATE — розпис рослинного походження | "Подовжній сволок із чільного боку має розпис рослинного походження." p.115

ДОЛІВКА (Clay floor):
- ДОЛІВКА — SURFACE_FINISH — бита, глиняна чи земляна | "Долівка – бита, глиняна чи земляна."
- ДОЛІВКА — MADE_OF — дерев'яна підлога з тесаних або різаних дощок | p.128
- ДОЛІВКА — MADE_OF — дерев'яна підлога з колотих дощок | p.20
- ДОЛІВКА — IS_PROTECTIVE_AGAINST — нечистих сил | "Вище долівки – для охорони від нечистих сил." p.5

ПОБІЛКА (Lime wash):
- ПОБІЛКА — MADE_OF — й побілена крейдою | "Зовні й усередині стіни обмащені глиною й побілені крейдою." p.49
- ПОБІЛКА — DECORATED_WITH — яскраво синім зеленим червоним | "Птахи й квіти розписані яскраво – синім, зеленим, червоним, блакитним, білим." p.76
- ПОБІЛКА — MADE_OF — і побілка мазанка | "хмизом – обмазка глиною і побілка (мазанка)." p.38

СТІНИ (Walls):
- WALL — DECORATED_WITH — геометричним орнаментом | "Застосовувалось різнокольорове мащення стін з невеликим додатком простенького геометричного орнаменту."
- WALL — DECORATED_WITH — настінний розпис | "декоративний настінний розпис виконувався на зовнішніх і внутрішніх стінах хати."
- WALL — MADE_OF — дерев'яні зрубні або каркасно стовпового типа | p.17
- WALL — IS_ANIMATE — видовжені стіни й високий дах | "Фасад завжди має видовжені стіни й високий дах." p.4
- WALL — IS_ORIENTED_COSMOLOGICALLY — Поділля Галичина | p.17
- WALL — IS_GENDERED — вкладали в стіни чоловіки | "розподіляли так: вальки крутили жінки, а вкладали в стіни чоловіки." p.121

СТІЛ (Table):
- TABLE — HAS_WIDTH — 70–90 см | "Стіл-скриню виготовляли з бука або клена | Ширина 70–90 см"
- TABLE — IS_PROTECTIVE_AGAINST — не можна сідати | "Не можна сідати на стіл, бо коли буде весілля, то коровай трісне наполовину."
- TABLE — MADE_OF — масивної стільниці | "Основа стола складалася з масивної стільниці."

КОМИН (Chimney):
- KOMYN — MADE_OF — з каркаса й обмащений глиною | "Комин зроблений з каркаса й обмащений глиною." p.49
- KOMYN — MADE_OF — з двох частин | "складається з двох частин: комина і спеціального пристрою для спалення скалки." p.110
- KOMYN — LOCATED_AT — PICH_STOVE

ОРНАМЕНТ (Ornamental frieze):
- ORNAMENTAL_FRIEZE — IS_ASSOCIATED_WITH — з освітленням хати | "Внутрішній розпис пов'язаний з освітленням хати." p.77
- ORNAMENTAL_FRIEZE — DECORATED_WITH — різьбою надто в Карпатах | "використовувалися орнаменти різьбою (надто в Карпатах)." p.5
- ORNAMENTAL_FRIEZE — IS_ANIMATE — оригінальні | "Декоративний настінний розпис у кожному селі має не схожий на інші, свої оригінальні." p.115
"""

SYSTEM_PROMPT = f"""You are an expert in Ukrainian vernacular architecture working with a validated knowledge base extracted from B4 Masnenko 2012, a Ukrainian ethnographic monograph on the Podillia khata.

Your task: given a user's text, annotate it using ONLY facts from the validated knowledge base below. Do not invent or add knowledge not in the KB.

{VALIDATED_KB}

Return ONLY valid JSON, no markdown, no preamble:
{{
  "enriched": [
    {{
      "term": "exact substring from the user text that matches a KB concept",
      "start": <integer character index where term starts in original text>,
      "end": <integer character index where term ends>,
      "annotation": "The validated KB fact that applies, with source page if available. 1-2 sentences.",
      "category": "one of: material | spatial | ritual | structural | decorative | cosmological"
    }}
  ],
  "summary": "One sentence summarising what validated knowledge applies to this text."
}}

Rules:
- Only annotate terms that genuinely match KB entries
- start/end must be exact character positions in the original text
- If nothing in the text matches the KB, return {{"enriched": [], "summary": "No validated knowledge found for this text."}}
- Never fabricate facts not in the KB above"""


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
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Annotate this text using the validated KB:\n\n{text}"}],
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
