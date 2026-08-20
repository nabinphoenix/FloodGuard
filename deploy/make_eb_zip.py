from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

source = Path("deploy/eb_build")
output = Path("deploy/floodguard-eb-v6.zip")

if output.exists():
    output.unlink()

with ZipFile(output, "w", ZIP_DEFLATED) as zf:
    for path in source.rglob("*"):
        if path.is_file():
            arcname = path.relative_to(source).as_posix()
            zf.write(path, arcname)

print(f"Created: {output}")
print(f"Size: {output.stat().st_size} bytes")
