"""Extract the original compact V4 header; never ship the demo action handlers."""
from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
source = root / 'design-reference/stitch-products/console.v4.original.html'
raw = source.read_text(encoding='utf-8')
header = re.search(r'<header\b.*?</header>', raw, re.S).group()
navigation = re.search(r'<nav\b.*?</nav>', raw, re.S).group()
markup = re.sub(r'\s+on\w+="[^"]*"', '', header + navigation)
(root / 'src/productos-stitch-v4-template.js').write_text(
    '// Original V4 header and five-tab navigation, without prototype handlers.\n'
    + 'export const STITCH_V4_HEADER=' + json.dumps(markup, ensure_ascii=False) + ';\n',
    encoding='utf-8')
(source.parent / 'provenance.v4.json').write_text(json.dumps({
    'project': '5869856515258186560', 'file': source.name,
    'sha256': hashlib.sha256(raw.encode()).hexdigest(),
    'use': 'Original compact header and navigation; business controls retain native API handlers; photo and density specifications applied across views.'
}, indent=2), encoding='utf-8')
