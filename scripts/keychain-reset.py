#!/usr/bin/env python3
"""
Backup, clear, or restore Seed account keys stored in the GNOME keyring.

Usage:
  python3 keychain-reset.py backup  <backup_dir>
  python3 keychain-reset.py restore <backup_dir>
  python3 keychain-reset.py clear

The daemon stores account keypairs under:
  service=seed-daemon-main  username=parentCollection
  service=seed-daemon-dev   username=parentCollection

We leave the Electron safeStorage encryption key (app_id=media.hyper.seed.dev)
untouched — clearing it would break SecureStore.json decryption on restore.
"""
import sys
import os
import json
import base64

KEYCHAIN_SERVICES = ["seed-daemon-main", "seed-daemon-dev"]
USERNAME = "parentCollection"

def get_collection():
    import secretstorage
    conn = secretstorage.dbus_init()
    return secretstorage.get_default_collection(conn)

def find_item(col, service):
    for item in col.get_all_items():
        attrs = item.get_attributes()
        if attrs.get("service") == service and attrs.get("username") == USERNAME:
            return item
    return None

def backup(backup_dir):
    col = get_collection()
    saved = {}
    for service in KEYCHAIN_SERVICES:
        item = find_item(col, service)
        if item:
            secret = item.get_secret()
            label = item.get_label()
            saved[service] = {
                "secret_b64": base64.b64encode(secret).decode("ascii"),
                "label": label,
            }
            print(f"[keychain] Backed up: {service} ({len(secret)} bytes)")
        else:
            print(f"[keychain] Not found: {service} (skipped)")
    os.makedirs(backup_dir, exist_ok=True)
    out_path = os.path.join(backup_dir, "keychain-backup.json")
    with open(out_path, "w") as f:
        json.dump(saved, f)
    print(f"[keychain] Backup written to {out_path}")

def clear():
    col = get_collection()
    for service in KEYCHAIN_SERVICES:
        item = find_item(col, service)
        if item:
            item.delete()
            print(f"[keychain] Cleared: {service}")
        else:
            print(f"[keychain] Not found: {service} (nothing to clear)")

def restore(backup_dir):
    import secretstorage
    in_path = os.path.join(backup_dir, "keychain-backup.json")
    if not os.path.exists(in_path):
        print(f"[keychain] No backup found at {in_path}, skipping restore")
        return
    with open(in_path) as f:
        saved = json.load(f)
    col = get_collection()
    for service, data in saved.items():
        # Remove any existing entry first
        existing = find_item(col, service)
        if existing:
            existing.delete()
        secret_bytes = base64.b64decode(data["secret_b64"])
        attrs = {
            "service": service,
            "username": USERNAME,
            "xdg:schema": "org.freedesktop.Secret.Generic",
        }
        col.create_item(data["label"], attrs, secret_bytes, replace=True)
        print(f"[keychain] Restored: {service} ({len(secret_bytes)} bytes)")

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
