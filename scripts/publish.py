#!/usr/bin/env python3
"""Publish immutable source bytes for SDLC's exact, already-validated release."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


def run(*args, binary=False):
    return subprocess.run(args, check=True, capture_output=True, text=not binary).stdout


def publish():
    version = os.environ["SDLC_RELEASE_VERSION"]
    merged = os.environ["SDLC_RELEASE_MERGED_SHA"]
    source = os.environ["SDLC_RELEASE_SOURCE_SHA"]
    receipt = Path(os.environ["SDLC_RELEASE_RECEIPTS"])
    repo = os.environ.get("GITHUB_REPOSITORY", "blogle/fieldnotes")
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
        raise ValueError("Invalid release version")
    if not all(re.fullmatch(r"[0-9a-f]{40}", sha) for sha in (merged, source)):
        raise ValueError("Release identity requires full lowercase commit SHAs")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid repository identity")
    if run("git", "rev-parse", "HEAD").strip() != merged or run("git", "rev-parse", "HEAD^").strip() != source:
        raise ValueError("Checkout does not match the merged release identity")
    manifest = json.loads(run("git", "show", f"{merged}:.sdlc/release.json"))
    if manifest.get("version") != version or manifest.get("source_main_sha") != source:
        raise ValueError("Manifest does not match publisher environment")
    name = f"fieldnotes-{version}-{merged}.tar.gz"
    # Archive committed bytes, never the working directory. Fixed gzip metadata permits retries.
    archive = gzip.compress(run("git", "archive", "--format=tar", f"--prefix=fieldnotes-{version}/", merged, binary=True), mtime=0)
    digest = hashlib.sha256(archive).hexdigest()
    release = json.loads(run("gh", "release", "view", f"v{version}", "--repo", repo, "--json", "assets"))
    with tempfile.TemporaryDirectory(prefix="fieldnotes-publish-") as directory:
        filename = Path(directory) / name
        if not any(asset["name"] == name for asset in release["assets"]):
            filename.write_bytes(archive)
            run("gh", "release", "upload", f"v{version}", str(filename), "--repo", repo)
            filename.unlink()
        run("gh", "release", "download", f"v{version}", "--pattern", name, "--dir", directory, "--repo", repo)
        if hashlib.sha256(filename.read_bytes()).hexdigest() != digest:
            raise ValueError("Remote source archive digest differs; refusing to overwrite or receipt it")
    payload = {"schema": 1, "artifacts": [{"name": name, "digest": f"sha256:{digest}", "version": version, "merged_sha": merged, "source_main_sha": source}]}
    receipt.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=receipt.parent, delete=False) as output:
        json.dump(payload, output, indent=2)
        output.write("\n")
        temporary = output.name
    os.replace(temporary, receipt)
    print(f"Verified {repo} v{version} / {name} sha256:{digest}")


if __name__ == "__main__":
    publish()
