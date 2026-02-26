#!/usr/bin/env python3
"""
Backup, clear, or restore Seed account keys stored in Windows Credential Manager.

Usage:
  python keychain-reset-win.py backup  <backup_dir>
  python keychain-reset-win.py restore <backup_dir>
  python keychain-reset-win.py clear

On Windows, go-keyring stores credentials with:
  TargetName = "<service>:<account>"  (UTF-8 blob, CRED_TYPE_GENERIC)

The Seed daemon keys live at:
  seed-daemon-main:parentCollection
  seed-daemon-dev:parentCollection

We use ctypes + Win32 CredReadW / CredWriteW / CredDeleteW directly so the
raw UTF-8 byte blob is preserved exactly as go-keyring wrote it (the Python
keyring library writes UTF-16 which would break go-keyring's JSON parsing).
"""
import sys
import os
import json
import base64
import ctypes
from ctypes import wintypes

TARGETS = [
    "seed-daemon-main:parentCollection",
    "seed-daemon-dev:parentCollection",
]

# ── Win32 structs ────────────────────────────────────────────────────────────

CRED_TYPE_GENERIC = 1
CRED_PERSIST_LOCAL_MACHINE = 2


class CREDENTIAL(ctypes.Structure):
    _fields_ = [
        ("Flags",              wintypes.DWORD),
        ("Type",               wintypes.DWORD),
        ("TargetName",         ctypes.c_wchar_p),
        ("Comment",            ctypes.c_wchar_p),
        ("LastWritten",        wintypes.FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob",     ctypes.POINTER(wintypes.BYTE)),
        ("Persist",            wintypes.DWORD),
        ("AttributeCount",     wintypes.DWORD),
        ("Attributes",         ctypes.c_void_p),
        ("TargetAlias",        ctypes.c_wchar_p),
        ("UserName",           ctypes.c_wchar_p),
    ]


advapi32 = ctypes.windll.advapi32  # type: ignore[attr-defined]

advapi32.CredReadW.argtypes = [ctypes.c_wchar_p, wintypes.DWORD, wintypes.DWORD,
                                ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
advapi32.CredReadW.restype  = wintypes.BOOL

advapi32.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
advapi32.CredWriteW.restype  = wintypes.BOOL

advapi32.CredDeleteW.argtypes = [ctypes.c_wchar_p, wintypes.DWORD, wintypes.DWORD]
advapi32.CredDeleteW.restype  = wintypes.BOOL

advapi32.CredFree.argtypes = [ctypes.c_void_p]
advapi32.CredFree.restype  = None


# ── helpers ──────────────────────────────────────────────────────────────────

def _read(target: str):
    """Return (blob_bytes, username) or None if not found."""
    p = ctypes.POINTER(CREDENTIAL)()
    ok = advapi32.CredReadW(target, CRED_TYPE_GENERIC, 0, ctypes.byref(p))
    if not ok:
        return None
    cred = p.contents
    blob = bytes(cred.CredentialBlob[:cred.CredentialBlobSize])
    username = cred.UserName or ""
    advapi32.CredFree(p)
    return blob, username


def _write(target: str, username: str, blob: bytes):
    """Write a generic credential with an exact byte blob."""
    arr = (wintypes.BYTE * len(blob))(*blob)
    cred = CREDENTIAL()
    cred.Flags              = 0
    cred.Type               = CRED_TYPE_GENERIC
    cred.TargetName         = target
    cred.Comment            = None
    cred.CredentialBlobSize = len(blob)
    cred.CredentialBlob     = arr
    cred.Persist            = CRED_PERSIST_LOCAL_MACHINE
    cred.AttributeCount     = 0
    cred.Attributes         = None
    cred.TargetAlias        = None
    cred.UserName           = username
    ok = advapi32.CredWriteW(ctypes.byref(cred), 0)
    if not ok:
        raise ctypes.WinError()


def _delete(target: str):
    """Delete a generic credential. Returns True if deleted, False if not found."""
    ok = advapi32.CredDeleteW(target, CRED_TYPE_GENERIC, 0)
    return bool(ok)


# ── commands ─────────────────────────────────────────────────────────────────

def backup(backup_dir):
    saved = {}
    for target in TARGETS:
        result = _read(target)
        if result:
            blob, username = result
            saved[target] = {
                "blob_b64": base64.b64encode(blob).decode("ascii"),
                "username": username,
            }
            print(f"[keychain-win] Backed up: {target} ({len(blob)} bytes)")
        else:
            print(f"[keychain-win] Not found: {target} (skipped)")

    os.makedirs(backup_dir, exist_ok=True)
    out_path = os.path.join(backup_dir, "keychain-win-backup.json")
    with open(out_path, "w") as f:
        json.dump(saved, f)
    print(f"[keychain-win] Backup written to {out_path}")


def clear():
    for target in TARGETS:
        if _delete(target):
            print(f"[keychain-win] Cleared: {target}")
        else:
            print(f"[keychain-win] Not found: {target} (nothing to clear)")


def restore(backup_dir):
    in_path = os.path.join(backup_dir, "keychain-win-backup.json")
    if not os.path.exists(in_path):
        print(f"[keychain-win] No backup found at {in_path}, skipping restore")
        return
    with open(in_path) as f:
        saved = json.load(f)
    for target, data in saved.items():
        blob     = base64.b64decode(data["blob_b64"])
        username = data.get("username", "parentCollection")
        # Remove any entry written during the test first
        _delete(target)
        _write(target, username, blob)
        print(f"[keychain-win] Restored: {target} ({len(blob)} bytes)")


# ── main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "backup":
        backup(sys.argv[2])
    elif cmd == "clear":
        clear()
    elif cmd == "restore":
        restore(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
