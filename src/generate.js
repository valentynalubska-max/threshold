export function setDot(dotId, lblId, live) {
  const d = document.getElementById(dotId);
  const l = document.getElementById(lblId);
  if (!d || !l) return;
  d.className = 'api-dot ' + (live ? 'live' : 'off');
  l.textContent = live ? 'live' : 'offline';
}

export async function checkApis() {
  try { const r = await fetch('/api/enrich', { method: 'OPTIONS' }); setDot('enrichDot', 'enrichStatus', r.ok); }
  catch { setDot('enrichDot', 'enrichStatus', false); }
  try { const r = await fetch('/api/generate', { method: 'OPTIONS' }); setDot('genDot', 'genStatus', r.ok); }
  catch { setDot('genDot', 'genStatus', false); }
}

export async function runGenerate() {
  const prompt = document.getElementById('genPrompt').value.trim();
  if (!prompt) return;
  const btn = document.getElementById('genBtn');
  const spinner = document.getElementById('genSpinner');
  const output = document.getElementById('genOutput');
  btn.disabled = true; spinner.classList.add('show'); output.classList.remove('show');
  spinner.textContent = 'Generating image...';
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.error) { spinner.textContent = 'Error: ' + data.error; return; }
    document.getElementById('genImg').src = data.url;
    output.classList.add('show'); spinner.classList.remove('show');
  } catch (e) {
    spinner.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}
