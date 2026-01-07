from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Tuple

import config
import core

@dataclass
class ManifestFile:
    rel_path: str
    content: str

def _parse_manifest(text: str) -> List[ManifestFile]:
    # Format:
    # ### FILE: path/to/file.ext
    # <content>
    lines = text.splitlines()
    out: List[ManifestFile] = []
    cur_path = None
    buf: List[str] = []
    for line in lines + ["### FILE: __EOF__"]:
        if line.startswith("### FILE:"):
            if cur_path is not None:
                out.append(ManifestFile(cur_path, "\n".join(buf).rstrip("\n") + "\n"))
            cur_path = line.split("### FILE:", 1)[1].strip()
            buf = []
        else:
            buf.append(line)
    # drop EOF
    out = [f for f in out if f.rel_path != "__EOF__"]
    return out

def _norm_rel(p: str) -> str:
    p = p.replace("\\", "/").strip()
    if p.startswith("/"):
        raise ValueError("absolute paths are not allowed")
    if ".." in Path(p).parts:
        raise ValueError(".. is not allowed")
    return str(Path(p))

def _is_allowed_path(abs_path: Path) -> bool:
    abs_path = abs_path.resolve()
    for root in config.UPDATE_ALLOW_ROOTS:
        try:
            abs_path.relative_to(root.resolve())
            return True
        except Exception:
            continue
    return False

def validate_manifest(text: str) -> Dict[str, Any]:
    try:
        files = _parse_manifest(text)
        if not files:
            return {"ok": False, "msg": "Manifest is empty"}
        items=[]
        for f in files:
            rel = _norm_rel(f.rel_path)
            abs_path = (config.BASE_DIR / rel).resolve()
            if not _is_allowed_path(abs_path):
                return {"ok": False, "msg": f"Path is not allowed: {rel}"}
            items.append({"path": rel, "bytes": len(f.content.encode("utf-8"))})
        return {"ok": True, "files": items}
    except Exception as e:
        return {"ok": False, "msg": str(e)}

def _backup_id() -> str:
    return time.strftime("%Y%m%d_%H%M%S")

def apply_manifest(text: str) -> Dict[str, Any]:
    v = validate_manifest(text)
    if not v.get("ok"):
        return v

    files = _parse_manifest(text)
    backup_id = _backup_id()
    bdir = (config.BACKUP_DIR / backup_id)
    bdir.mkdir(parents=True, exist_ok=True)

    # record of operations for rollback
    ops = {"backup_id": backup_id, "files": []}

    try:
        changed_py = []

        for f in files:
            rel = _norm_rel(f.rel_path)
            abs_path = (config.BASE_DIR / rel).resolve()
            abs_path.parent.mkdir(parents=True, exist_ok=True)

            existed = abs_path.exists()
            backup_path = (bdir / rel)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            if existed:
                backup_path.write_bytes(abs_path.read_bytes())

            # atomic write
            tmp = abs_path.with_suffix(abs_path.suffix + ".tmp")
            tmp.write_text(f.content, encoding="utf-8")
            tmp.replace(abs_path)

            ops["files"].append({"path": rel, "existed": existed})

            if abs_path.suffix == ".py":
                changed_py.append(rel)

        # save ops + original manifest
        import json

        (bdir / "meta.json").write_text(json.dumps(ops, ensure_ascii=False, indent=2), encoding="utf-8")
        (bdir / "manifest.txt").write_text(text, encoding="utf-8")

        # sanity-check python
        if changed_py:
            rc, out = core.run(["python3", "-m", "py_compile"] + [str(config.BASE_DIR / p) for p in changed_py], timeout=60)
            if rc != 0:
                raise RuntimeError("py_compile failed:\n" + out)

        # restart UI service
        rc, out = core.run(["systemctl", "restart", config.UI_SERVICE], timeout=60)
        if rc != 0:
            raise RuntimeError("UI restart failed:\n" + out)

        return {"ok": True, "backup_id": backup_id, "msg": "Applied & restarted", "files": v.get("files", [])}

    except Exception as e:
        # rollback
        rb = rollback(backup_id)
        return {"ok": False, "backup_id": backup_id, "msg": f"Apply failed: {e}", "rollback": rb}

def list_backups() -> List[Dict[str, Any]]:
    out=[]
    if not config.BACKUP_DIR.exists():
        return out
    for p in sorted(config.BACKUP_DIR.glob("*"), reverse=True):
        if not p.is_dir():
            continue
        meta = core.jload(p/"meta.json", {})
        out.append({"id": p.name, "files": meta.get("files", []), "ts": p.name})
    return out

def rollback(backup_id: str) -> Dict[str, Any]:
    try:
        bdir = (config.BACKUP_DIR / backup_id)
        meta = core.jload(bdir / "meta.json", None)
        if not meta or not isinstance(meta, dict):
            return {"ok": False, "msg": "backup meta not found"}
        files = meta.get("files") or []
        if not isinstance(files, list):
            return {"ok": False, "msg": "bad backup meta"}

        restored=[]
        for it in files:
            rel = it.get("path")
            existed = bool(it.get("existed"))
            if not rel:
                continue
            abs_path = (config.BASE_DIR / rel).resolve()
            backup_path = (bdir / rel).resolve()

            if existed:
                if not backup_path.exists():
                    raise RuntimeError(f"missing backup file for {rel}")
                abs_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = abs_path.with_suffix(abs_path.suffix + ".tmp")
                tmp.write_bytes(backup_path.read_bytes())
                tmp.replace(abs_path)
            else:
                # file did not exist before -> remove it
                if abs_path.exists():
                    abs_path.unlink()

            restored.append(rel)

        # restart UI again
        core.run(["systemctl", "restart", config.UI_SERVICE], timeout=60)
        return {"ok": True, "msg": "Rolled back", "files": restored}
    except Exception as e:
        return {"ok": False, "msg": str(e)}
