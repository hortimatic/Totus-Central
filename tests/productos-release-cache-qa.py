"""Exercise the actual Pages assembly in a disposable, local-only directory."""
from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
workflow = (root / '.github/workflows/publish.yml').read_text(encoding='utf-8')
embedded = workflow.split("python3 - <<'PY'\n", 1)[1].split('\n          PY', 1)[0]
assembly = '\n'.join(line[10:] if line.startswith('          ') else line for line in embedded.splitlines())
artifacts = (root / 'qa-artifacts').resolve()
artifacts.mkdir(exist_ok=True)
sha = 'a' * 40
with tempfile.TemporaryDirectory(prefix='release-cache-', dir=artifacts) as directory:
    temp = Path(directory).resolve()
    assert temp.is_relative_to(artifacts), 'Disposable assembly must remain inside QA artifacts'
    for name in ['index.html', 'favicon.svg', 'fondo_original.png']:
        shutil.copyfile(root / name, temp / name)
    for name in ['src', 'assets']:
        shutil.copytree(root / name, temp / name)
    subprocess.run([sys.executable, '-X', 'utf8', '-c', assembly], cwd=temp,
                   env={**os.environ, 'GITHUB_SHA': sha}, check=True, capture_output=True)
    site = temp / '_site'
    assert f'href="src/productos.css?v={sha}"' in (site / 'index.html').read_text(encoding='utf-8')
    css = (site / 'src/productos.css').read_text(encoding='utf-8')
    for name in ['productos-professional.css', 'productos-photo-preview.css', 'productos-stitch.css']:
        assert f'./{name}?v={sha}' in css, f'{name} must refresh with the release'
    ui = (site / 'src/productos-ui.js').read_text(encoding='utf-8')
    for name in ['productos-dialogs.js', 'productos-photo-preview.js', 'productos-stitch-view.js']:
        assert f'./{name}?v={sha}' in ui
    for css_file in (site / 'src').rglob('*.css'):
        assert not re.search(r"@import\s+url\(\s*['\"]\.[^'\"]+\.css['\"]", css_file.read_text(encoding='utf-8')), 'No unversioned local CSS imports'
    assert not (site / 'supabase').exists() and not (site / 'tests').exists()
print('Products release cache: actual Pages assembly versions linked CSS, nested CSS and JS modules; no business writes: PASS')
