"""API de démonstration sur une transcription fictive fournie avec le projet."""

import os
from collections.abc import Callable
from threading import Lock
from typing import Literal, TypedDict
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, status
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from pydantic import BaseModel, ConfigDict, StrictBool

from .core import TRANSCRIPT, ExtractionError, Item, Segment, check_evidence, extract_fixture


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approved: StrictBool


class DraftState(TypedDict, total=False):
    items: list[Item]
    status: Literal["pending_review", "approved", "rejected"]


def verify(state: DraftState) -> dict:
    check_evidence(state["items"], TRANSCRIPT)
    return {"status": "pending_review"}


def review(_: DraftState) -> dict:
    approved = interrupt({"reason": "Validation humaine requise."})
    return {"status": "approved" if approved is True else "rejected"}


def create_app(
    extractor: Callable[[list[Segment]], list[Item]] = extract_fixture,
    mode: Literal["fixture", "azure_openai"] = "fixture",
) -> FastAPI:
    def extract(_: DraftState) -> dict:
        return {"items": extractor(TRANSCRIPT)}

    flow = StateGraph(DraftState)
    flow.add_node("extract", extract)
    flow.add_node("verify", verify)
    flow.add_node("review", review)
    flow.add_edge(START, "extract")
    flow.add_edge("extract", "verify")
    flow.add_edge("verify", "review")
    flow.add_edge("review", END)
    checkpointer = InMemorySaver()
    graph = flow.compile(checkpointer=checkpointer)
    lock = Lock()

    app = FastAPI(
        title="Relevé de décisions — démonstrateur",
        description="Le démonstrateur utilise une transcription fictive et affiche le mode d’extraction actif.",
    )

    def config(draft_id: UUID) -> dict:
        return {"configurable": {"thread_id": str(draft_id)}}

    def response(draft_id: UUID) -> dict:
        state = graph.get_state(config(draft_id)).values
        if not state:
            raise HTTPException(status_code=404, detail="Brouillon inconnu.")
        return {"id": str(draft_id), "mode": mode, **state}

    @app.get("/healthz")
    def health() -> dict:
        return {"status": "ok", "mode": mode}

    @app.get("/transcript")
    def transcript() -> list[dict]:
        return TRANSCRIPT

    @app.post("/drafts", status_code=status.HTTP_201_CREATED)
    def create_draft() -> dict:
        draft_id = uuid4()
        with lock:
            try:
                graph.invoke({}, config(draft_id))
            except ExtractionError as error:
                checkpointer.delete_thread(str(draft_id))
                raise HTTPException(status_code=502, detail=str(error)) from None
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


def configured_app() -> FastAPI:
    mode = os.getenv("PV_MODE", "fixture")
    if mode == "fixture":
        return create_app()
    if mode == "azure_openai":
        from .foundry import configured_extractor

        return create_app(configured_extractor(), mode)
    raise ValueError("PV_MODE doit être fixture ou azure_openai.")


app = configured_app()
