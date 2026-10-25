import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("publisher", Path(__file__).parents[1] / "scripts/publish.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublisherTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.receipts = Path(self.directory.name) / "receipt.json"
        self.remote = {}
        self.uploads = 0
        self.merged, self.source = "a" * 40, "b" * 40
        self.env = {"SDLC_RELEASE_VERSION": "0.1.0", "SDLC_RELEASE_MERGED_SHA": self.merged,
                    "SDLC_RELEASE_SOURCE_SHA": self.source, "SDLC_RELEASE_RECEIPTS": str(self.receipts),
                    "GITHUB_REPOSITORY": "blogle/fieldnotes"}

    def run_command(self, *args, binary=False):
        if args[:2] == ("git", "rev-parse"):
            return self.merged if args[2] == "HEAD" else self.source
        if args[:2] == ("git", "show"):
            return json.dumps({"version": "0.1.0", "source_main_sha": self.source})
        if args[:2] == ("git", "archive"):
            self.assertEqual(args[-1], self.merged)
            self.assertTrue(binary)
            return b"exact committed archive bytes"
        if args[:3] == ("gh", "release", "view"):
            return json.dumps({"assets": [{"name": name} for name in self.remote]})
        if args[:3] == ("gh", "release", "upload"):
            file = Path(args[4])
            self.assertNotIn(file.name, self.remote)
            self.assertNotIn("--clobber", args)
            self.remote[file.name] = file.read_bytes()
            self.uploads += 1
            return ""
        if args[:3] == ("gh", "release", "download"):
            name = args[args.index("--pattern") + 1]
            directory = Path(args[args.index("--dir") + 1])
            (directory / name).write_bytes(self.remote[name])
            return ""
        raise AssertionError(args)

    def invoke(self):
        with patch.dict(os.environ, self.env), patch.object(publisher, "run", side_effect=self.run_command):
            publisher.publish()

    def test_upload_readback_and_identity_receipt(self):
        self.invoke()
        receipt = json.loads(self.receipts.read_text())["artifacts"][0]
        asset = self.remote[receipt["name"]]
        self.assertEqual(gzip.decompress(asset), b"exact committed archive bytes")
        self.assertEqual(receipt["digest"], "sha256:" + hashlib.sha256(asset).hexdigest())
        self.assertEqual(receipt["merged_sha"], self.merged)
        self.assertEqual(receipt["source_main_sha"], self.source)

    def test_retry_verifies_existing_bytes_without_reupload(self):
        self.invoke()
        first = self.receipts.read_bytes()
        self.invoke()
        self.assertEqual(self.uploads, 1)
        self.assertEqual(self.receipts.read_bytes(), first)

    def test_conflicting_remote_asset_is_never_overwritten(self):
        self.remote[f"fieldnotes-0.1.0-{self.merged}.tar.gz"] = b"wrong bytes"
        with self.assertRaisesRegex(ValueError, "digest differs"):
            self.invoke()
        self.assertFalse(self.receipts.exists())
        self.assertEqual(self.uploads, 0)

    def test_invalid_identity_has_no_remote_side_effects(self):
        self.env["SDLC_RELEASE_VERSION"] = "not-a-version"
        with self.assertRaisesRegex(ValueError, "Invalid release version"):
            self.invoke()
        self.assertEqual(self.remote, {})

    def test_wrong_checkout_is_rejected(self):
        self.env["SDLC_RELEASE_MERGED_SHA"] = "c" * 40
        with self.assertRaisesRegex(ValueError, "Checkout does not match"):
            self.invoke()
        self.assertFalse(self.receipts.exists())


if __name__ == "__main__":
    unittest.main()
