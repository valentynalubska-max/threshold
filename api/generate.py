import json
import os
from http.server import BaseHTTPRequestHandler

import fal_client


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            prompt = body.get("prompt", "").strip()

            if not prompt:
                self._json(400, {"error": "prompt is required"})
                return

            api_key = os.environ.get("FAL_KEY")
            if not api_key:
                self._json(500, {"error": "FAL_KEY not configured"})
                return

            os.environ["FAL_KEY"] = api_key

            # Build the request — lora_path is optional, add yours when ready
            payload = {
                "prompt": prompt,
                "image_size": "landscape_4_3",
                "num_inference_steps": 28,
                "guidance_scale": 3.5,
                "num_images": 1,
                "enable_safety_checker": True,
            }

            # If a LoRA URL is configured, attach it
            lora_url = os.environ.get("FAL_LORA_URL")
            if lora_url:
                payload["loras"] = [{"path": lora_url, "scale": 1.0}]

            result = fal_client.run("fal-ai/flux-lora", arguments=payload)

            images = result.get("images", [])
            if not images:
                self._json(500, {"error": "No images returned from fal.ai"})
                return

            self._json(200, {
                "url": images[0]["url"],
                "width": images[0].get("width"),
                "height": images[0].get("height"),
            })

        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, *args):
        pass
