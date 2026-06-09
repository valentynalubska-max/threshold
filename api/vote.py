import json
import os
from http.server import BaseHTTPRequestHandler

from supabase import create_client


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))

            triple_id  = body.get("triple_id", "").strip()
            triple_str = body.get("triple", "").strip()
            source     = body.get("source", "").strip()
            vote       = body.get("vote", "").strip().upper()

            if not triple_id or not vote:
                self._json(400, {"error": "triple_id and vote are required"})
                return

            if vote not in ("TRUE", "FALSE", "CONTESTED"):
                self._json(400, {"error": "vote must be TRUE, FALSE, or CONTESTED"})
                return

            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_ANON_KEY")
            if not url or not key:
                self._json(500, {"error": "Supabase not configured"})
                return

            sb = create_client(url, key)

            # Upsert so re-voting updates rather than duplicates
            result = (
                sb.table("votes")
                .upsert(
                    {
                        "triple_id":  triple_id,
                        "triple":     triple_str,
                        "source":     source,
                        "vote":       vote,
                    },
                    on_conflict="triple_id",
                )
                .execute()
            )

            self._json(200, {"ok": True, "vote": vote, "triple_id": triple_id})

        except Exception as e:
            self._json(500, {"error": str(e)})

    def do_GET(self):
        """Return vote counts for all triples — useful for showing tallies."""
        try:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_ANON_KEY")
            if not url or not key:
                self._json(500, {"error": "Supabase not configured"})
                return

            sb = create_client(url, key)
            result = sb.table("votes").select("triple_id, vote").execute()
            rows = result.data or []

            # Aggregate counts
            counts = {}
            for row in rows:
                tid  = row["triple_id"]
                vote = row["vote"]
                if tid not in counts:
                    counts[tid] = {"TRUE": 0, "FALSE": 0, "CONTESTED": 0}
                counts[tid][vote] = counts[tid].get(vote, 0) + 1

            self._json(200, {"counts": counts})

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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, *args):
        pass
