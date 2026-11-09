"""Scénario fictif et règles vérifiables, indépendantes de l’API et du graphe."""

import json
import re
from typing import Literal, TypedDict


class Segment(TypedDict):
    source_id: str
    text: str


class Item(TypedDict):
    kind: Literal["decision", "action"]
    text: str
    due_date: str | None
    source_id: str
    quote: str


class ExtractionError(RuntimeError):
    """Échec explicite du fournisseur d’extraction, sans brouillon publiable."""


TRANSCRIPT: list[Segment] = [
    {
        "source_id": "T01",
        "text": "Point d’information : deux créneaux sont encore à l’étude.",
    },
    {
        "source_id": "T02",
        "text": "Décision : tester un créneau d’accueil administratif le mardi matin.",
    },
    {
        "source_id": "T03",
        "text": "Action : préparer une note d’information pour l’équipe d’accueil.",
    },
    {
        "source_id": "T04",
        "text": "Action : préparer le formulaire de retour. Échéance : 2026-11-20.",
    },
]

EXPLICIT_DATE = re.compile(r" Échéance : (\d{4}-\d{2}-\d{2})\.$")


def extract_fixture(transcript: list[Segment]) -> list[Item]:
    """Extracteur déterministe pour les formulations balisées de la réunion fictive."""
    items: list[Item] = []
    for segment in transcript:
        text = segment["text"]
        if text.startswith("Décision : "):
            kind: Literal["decision", "action"] = "decision"
        elif text.startswith("Action : "):
            kind = "action"
        else:
            continue

        statement = text.split(": ", maxsplit=1)[1]
        date_match = EXPLICIT_DATE.search(statement)
        items.append(
            {
                "kind": kind,
                "text": statement[: date_match.start()] if date_match else statement,
                "due_date": date_match.group(1) if date_match else None,
                "source_id": segment["source_id"],
                "quote": text,
            }
        )
    return items


def check_evidence(items: list[Item], transcript: list[Segment]) -> None:
    sources = {segment["source_id"]: segment["text"] for segment in transcript}
    for item in items:
        source_text = sources.get(item["source_id"])
        if source_text is None or item["quote"] != source_text:
            raise ValueError("Citation absente de la source indiquée.")
        date_match = EXPLICIT_DATE.search(source_text)
        explicit_date = date_match.group(1) if date_match else None
        if item["due_date"] != explicit_date:
            raise ValueError("L’échéance doit correspondre à la date explicite de la source.")


if __name__ == "__main__":
    draft = extract_fixture(TRANSCRIPT)
    check_evidence(draft, TRANSCRIPT)
    print(json.dumps({"mode": "fixture", "status": "pending_review", "items": draft}, ensure_ascii=False, indent=2))
