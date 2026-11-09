"""API de démonstration sur une transcription fictive fournie avec le projet."""

from threading import Lock
from typing import Literal, TypedDict
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, status
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from pydantic import BaseModel, ConfigDict, StrictBool

from .core import TRANSCRIPT, Item, check_evidence, extract_fixture


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approved: StrictBool


class DraftState(TypedDict, total=False):
    items: list[Item]
    status: Literal["pending_review", "approved", "rejected"]


def extract(_: DraftState) -> dict:
    return {"items": extract_fixture(TRANSCRIPT)}


def verify(state: DraftState) -> dict:
    check_evidence(state["items"], TRANSCRIPT)
    return {"status": "pending_review"}


def review(_: DraftState) -> dict:
    approved = interrupt({"reason": "Validation humaine requise."})
    return {"status": "approved" if approved is True else "rejected"}


def create_app() -> FastAPI:
    flow = StateGraph(DraftState)
    flow.add_node("extract", extract)
    flow.add_node("verify", verify)
    flow.add_node("review", review)
    flow.add_edge(START, "extract")
    flow.add_edge("extract", "verify")
    flow.add_edge("verify", "review")
    flow.add_edge("review", END)
    graph = flow.compile(checkpointer=InMemorySaver())
    lock = Lock()

    app = FastAPI(
        title="Relevé de décisions — démonstrateur",
        description="Le mode fixture utilise une transcription fictive balisée, sans modèle externe.",
    )

    def config(draft_id: UUID) -> dict:
        return {"configurable": {"thread_id": str(draft_id)}}

    def response(draft_id: UUID) -> dict:
        state = graph.get_state(config(draft_id)).values
        if not state:
            raise HTTPException(status_code=404, detail="Brouillon inconnu.")
        return {"id": str(draft_id), "mode": "fixture", **state}

    @app.get("/healthz")
    def health() -> dict:
        return {"status": "ok", "mode": "fixture"}

    @app.get("/transcript")
    def transcript() -> list[dict]:
        return TRANSCRIPT

    @app.post("/drafts", status_code=status.HTTP_201_CREATED)
    def create_draft() -> dict:
        draft_id = uuid4()
        with lock:
            graph.invoke({}, config(draft_id))
            return response(draft_id)

    @app.get("/drafts/{draft_id}")
    def get_draft(draft_id: UUID) -> dict:
        with lock:
            return response(draft_id)

    @app.post("/drafts/{draft_id}/review")
    def submit_review(draft_id: UUID, payload: ReviewInput) -> dict:
        with lock:
            current = response(draft_id)
            if current["status"] != "pending_review":
                raise HTTPException(status_code=409, detail="Ce brouillon a déjà été examiné.")
            graph.invoke(Command(resume=payload.approved), config(draft_id))
            return response(draft_id)

    return app


app = create_app()
