"""Build the dependency-free AWS sensor simulator Lambda package."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SOURCE = REPOSITORY_ROOT / "lambda" / "sensor_simulator"
OUTPUT = REPOSITORY_ROOT / "deploy" / "floodguard-sensor-simulator.zip"


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        OUTPUT.unlink()

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for path in SOURCE.iterdir():
            if path.name.startswith("test_") or path.suffix == ".pyc":
                continue
            if path.is_file():
                archive.write(path, path.name)

    print(f"Created: {OUTPUT}")
    print(f"Size: {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
