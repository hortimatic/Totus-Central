"""Build the reviewed module without credentials or unrelated project files."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
module = root / "prestashop" / "modules" / "totusproductbridge"
output = root / "qa-artifacts" / "totusproductbridge-1.1.0.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(module.rglob("*.php")):
        info = zipfile.ZipInfo("totusproductbridge/" + path.relative_to(module).as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
print(output)
