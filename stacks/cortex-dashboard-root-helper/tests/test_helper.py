import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import helper


class HelperTest(unittest.TestCase):
	def test_execute_success_hashes_output(self):
		request = helper.validate_request(
			{
				"request_id": "00000000-0000-4000-8000-000000000001",
				"command": "/bin/echo",
				"argv": ["ok"],
				"cwd": "/",
			}
		)
		response = helper.execute_command(request)
		self.assertEqual(response["status"], "succeeded")
		self.assertEqual(response["exit_code"], 0)
		self.assertEqual(response["stdout"], "ok\n")
		self.assertEqual(response["stdout_sha256"], helper.sha256(b"ok\n"))

	def test_rejects_bad_env_name(self):
		with self.assertRaises(ValueError):
			helper.validate_request(
				{
					"request_id": "00000000-0000-4000-8000-000000000001",
					"command": "/bin/true",
					"env": {"BAD-NAME": "x"},
				}
			)

	def test_protocol_response_is_json_safe(self):
		request = helper.validate_request(
			{
				"request_id": "00000000-0000-4000-8000-000000000001",
				"command": "/bin/true",
				"cwd": "/",
				"dry_run": True,
			}
		)
		encoded = json.dumps(helper.execute_command(request))
		self.assertIn("dry_run", encoded)


if __name__ == "__main__":
	unittest.main()
