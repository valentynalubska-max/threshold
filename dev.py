"""Local dev server that mimics Vite's publicDir fallback."""
from http.server import HTTPServer, BaseHTTPRequestHandler
import os, sys, urllib.parse, mimetypes

ROOT = os.path.normpath(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')

def resolve(rel):
    """Try ROOT first, then PUBLIC."""
    for base in (ROOT, PUBLIC):
        p = os.path.normpath(os.path.join(base, rel))
        if os.path.isfile(p):
            return p
    return None

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        rel = path.lstrip('/') or 'index.html'
        filepath = resolve(rel) or resolve('index.html')
        if not filepath:
            self.send_error(404)
            return
        mime, _ = mimetypes.guess_type(filepath)
        with open(filepath, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', mime or 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
print(f'  Dev server: http://localhost:{port}')
HTTPServer(('', port), Handler).serve_forever()
