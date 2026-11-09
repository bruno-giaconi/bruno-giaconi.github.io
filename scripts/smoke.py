"""Exécute le même parcours HTTP en local, dans Docker ou sur un port-forward."""

import json
import sys
from urllib.request import Request, urlopen


def run(base_url: str, mode: str = "fixture") -> None:
    def request(path: str, method: str = "GET", payload: dict | None = None) -> dict:
        data = json.dumps(payload).encode() if payload is not None else None
        req = Request(
            base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"} if data else {},
        )
        with urlopen(req, timeout=45 if mode == "azure_openai" else 5) as response:
            return json.load(response)

    assert request("/healthz") == {"status": "ok", "mode": mode}
    draft = request("/drafts", method="POST")
    assert draft["mode"] == mode
    assert draft["status"] == "pending_review"
    assert [item["source_id"] for item in draft["items"]] == ["T02", "T03", "T04"]
    assert draft["items"][1]["due_date"] is None
    assert draft["items"][2]["due_date"] == "2026-11-20"

    approval = request(f"/drafts/{draft['id']}/review", method="POST", payload={"approved": True})
    assert approval == {**draft, "status": "approved"}
    print("Parcours HTTP validé : trois sources, échéance absente préservée, approbation séparée.")


if __name__ == "__main__":
    url = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    run(url, sys.argv[2] if len(sys.argv) > 2 else "fixture")
