"""
SIHTRACK Project Packaging Script
Creates a clean, portable ZIP archive for the SIH team.
Excludes node_modules, virtual environments, caches, dist, and temporary artifacts.
"""
import os
import zipfile
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
ARCHIVE_NAME = "SIHTRACK_Extreme_Weather_Intelligence_SIH26078.zip"
OUTPUT_ZIP = ROOT_DIR / ARCHIVE_NAME

EXCLUDE_DIRS = {
    "node_modules",
    "dist",
    ".vite",
    "__pycache__",
    ".pytest_cache",
    ".git",
    ".github",
    ".venv",
    "venv",
    "env",
    ".idea",
    ".vscode",
    "frontend",  # Junction symlink to sih-ews, avoid duplication
}

EXCLUDE_EXTS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".log",
    ".tmp",
    ".DS_Store",
}

EXCLUDE_FILES = {
    "Thumbs.db",
    ARCHIVE_NAME,
}

def should_exclude(rel_path: Path) -> bool:
    parts = rel_path.parts
    # Check directory exclusion
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    # Check file extension
    if rel_path.suffix in EXCLUDE_EXTS:
        return True
    # Check file name
    if rel_path.name in EXCLUDE_FILES or rel_path.name.endswith(".zip"):
        return True
    return False

def create_project_zip():
    print(f"Creating project ZIP archive from: {ROOT_DIR}")
    print(f"Destination: {OUTPUT_ZIP}")
    
    file_count = 0
    total_size = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(ROOT_DIR):
            # Modify dirs in-place to skip excluded directories early
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
            
            for file in sorted(files):
                full_path = Path(root) / file
                rel_path = full_path.relative_to(ROOT_DIR)
                
                if should_exclude(rel_path):
                    continue
                
                # Check for symlink/junction
                if full_path.is_symlink():
                    continue

                archive_path = Path("sihtrack") / rel_path
                zf.write(full_path, archive_path)
                file_count += 1
                total_size += full_path.stat().st_size
                
    zip_size_mb = OUTPUT_ZIP.stat().st_size / (1024 * 1024)
    raw_size_mb = total_size / (1024 * 1024)
    
    print("=" * 60)
    print("ZIP Archive Created Successfully!")
    print(f"File Name:     {OUTPUT_ZIP.name}")
    print(f"Full Path:     {OUTPUT_ZIP.resolve()}")
    print(f"Total Files:   {file_count}")
    print(f"Uncompressed:  {raw_size_mb:.2f} MB")
    print(f"Compressed:    {zip_size_mb:.2f} MB")
    print("=" * 60)

if __name__ == "__main__":
    create_project_zip()
