from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient

from pv_demo.api import create_app


class ReviewTests(TestCase):
    def setUp(self):
        self.client = TestClient(create_app())

    def test_draft_waits_for_review_and_preserves_evidence(self):
        create = self.client.post("/drafts")
        self.assertEqual(create.status_code, 201, create.text)
        draft = create.json()
        self.assertEqual(draft["mode"], "fixture")
        self.assertEqual(draft["status"], "pending_review")
        self.assertIsNone(draft["items"][1]["due_date"])

        path = f"/drafts/{draft['id']}"
        self.assertEqual(self.client.get(path).json(), draft)
        approval = self.client.post(f"{path}/review", json={"approved": True})
        self.assertEqual(approval.status_code, 200, approval.text)
        self.assertEqual(approval.json(), {**draft, "status": "approved"})
        self.assertEqual(self.client.post(f"{path}/review", json={"approved": True}).status_code, 409)

    def test_can_reject_without_changing_a_second_draft(self):
        first = self.client.post("/drafts").json()
        second = self.client.post("/drafts").json()
        rejection = self.client.post(f"/drafts/{first['id']}/review", json={"approved": False})
        self.assertEqual(rejection.status_code, 200, rejection.text)
        self.assertEqual(rejection.json()["status"], "rejected")
        self.assertEqual(self.client.get(f"/drafts/{second['id']}").json()["status"], "pending_review")

    def test_rejects_non_boolean_approval_and_unknown_id(self):
        draft = self.client.post("/drafts").json()
        path = f"/drafts/{draft['id']}"
        self.assertEqual(self.client.post(f"{path}/review", json={"approved": "true"}).status_code, 422)
        self.assertEqual(self.client.get(path).json()["status"], "pending_review")
        self.assertEqual(self.client.get(f"/drafts/{uuid4()}").status_code, 404)
