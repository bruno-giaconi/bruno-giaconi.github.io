from unittest import TestCase

from pv_demo.core import TRANSCRIPT, check_evidence, extract_fixture


class ExtractionTests(TestCase):
    def test_decision_traceability_and_undated_action(self):
        items = extract_fixture(TRANSCRIPT)
        check_evidence(items, TRANSCRIPT)
        self.assertEqual([item["source_id"] for item in items], ["T02", "T03", "T04"])
        self.assertEqual(items[0]["kind"], "decision")
        self.assertIsNone(items[1]["due_date"])
        self.assertEqual(items[2]["due_date"], "2026-11-20")

    def test_rejects_invented_deadline(self):
        items = extract_fixture(TRANSCRIPT)
        items[1]["due_date"] = "2026-11-19"
        with self.assertRaisesRegex(ValueError, "échéance"):
            check_evidence(items, TRANSCRIPT)

    def test_rejects_citation_with_wrong_source(self):
        items = extract_fixture(TRANSCRIPT)
        items[0]["source_id"] = "T01"
        with self.assertRaisesRegex(ValueError, "Citation"):
            check_evidence(items, TRANSCRIPT)
