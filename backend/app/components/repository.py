from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from .changes import document_changes
from .models import ComponentAction, ComponentDocument, Revision, TypedAction
from .service import ComponentError, apply_action, create_component_document, validate_component
from pydantic import TypeAdapter


def envelope(draft_id: str, document: ComponentDocument) -> dict:
    return {"draftId": draft_id, "document": document.model_dump(by_alias=True), "checks": validate_component(document)}


class DraftRepository:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection, connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS component_drafts (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL,
                document TEXT NOT NULL, updated_at TEXT NOT NULL
            )""")
            connection.execute("""CREATE TABLE IF NOT EXISTS component_draft_changes (
                draft_id TEXT NOT NULL, revision INTEGER NOT NULL,
                actor TEXT NOT NULL, created_at TEXT NOT NULL, items TEXT NOT NULL,
                PRIMARY KEY (draft_id, revision)
            )""")

    def _connect(self):
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        return connection

    def create(self, name: str | None = None, document: ComponentDocument | None = None) -> dict:
        if document is None:
            document = create_component_document()
        else:
            document = ComponentDocument.model_validate(document.model_dump(by_alias=True))
        if name is not None:
            data = document.model_dump(by_alias=True)
            data["definition"]["name"] = name
            document = ComponentDocument.model_validate(data)
        draft_id = str(uuid4())
        with closing(self._connect()) as connection, connection:
            connection.execute("INSERT INTO component_drafts VALUES (?, ?, ?, ?, ?)", (
                draft_id, document.definition.name, document.revision, document.model_dump_json(by_alias=True), self._now(),
            ))
        return envelope(draft_id, document)

    def list(self) -> dict:
        with closing(self._connect()) as connection:
            rows = connection.execute("SELECT id, name, revision, updated_at FROM component_drafts ORDER BY updated_at DESC, id").fetchall()
        return {"items": [{"draftId": row["id"], "name": row["name"], "revision": row["revision"], "updatedAt": row["updated_at"]} for row in rows]}

    def get(self, draft_id: str, after_revision: int = 0) -> dict:
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN")
            document = self._read(connection, draft_id)
            return self._envelope(connection, draft_id, document, after_revision)

    def update(self, draft_id: str, expected_revision: int, action: TypedAction, *, actor: str = "user") -> dict:
        if actor not in ("user", "agent"):
            raise ValueError("Unknown edit source")
        expected_revision = TypeAdapter(Revision).validate_python(expected_revision)
        action = ComponentAction.validate_python(action)
        with closing(self._connect()) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            document = self._read(connection, draft_id)
            reconciled = False
            if document.revision != expected_revision:
                history = connection.execute("""SELECT COUNT(*) AS total,
                    SUM(CASE WHEN actor = 'agent' THEN 1 ELSE 0 END) AS agents
                    FROM component_draft_changes WHERE draft_id = ? AND revision > ? AND revision <= ?""",
                    (draft_id, expected_revision, document.revision)).fetchone()
                reconciled = (actor == "user" and action.type != "reset" and expected_revision < document.revision
                              and history["total"] == history["agents"] == document.revision - expected_revision)
                if not reconciled:
                    raise ComponentError(409, "REVISION_CONFLICT", self._envelope(connection, draft_id, document, expected_revision))
            try:
                updated = apply_action(document, action)
            except ComponentError as error:
                if reconciled:
                    code = "EDIT_TARGET_REMOVED" if error.code in ("COMPONENT_ITEM_NOT_FOUND", "INVALID_REFERENCE") else "EDIT_STRUCTURE_CONFLICT"
                    raise ComponentError(409, code, self._envelope(connection, draft_id, document, expected_revision)) from error
                raise
            if updated.revision != document.revision:
                now = self._now()
                connection.execute("UPDATE component_drafts SET name = ?, revision = ?, document = ?, updated_at = ? WHERE id = ?", (
                    updated.definition.name, updated.revision, updated.model_dump_json(by_alias=True), now, draft_id,
                ))
                items = document_changes(document.model_dump(by_alias=True), updated.model_dump(by_alias=True))
                connection.execute("INSERT INTO component_draft_changes VALUES (?, ?, ?, ?, ?)", (
                    draft_id, updated.revision, actor, now, json.dumps(items, ensure_ascii=False),
                ))
            result = self._envelope(connection, draft_id, updated, expected_revision)
            result["reconciled"] = reconciled
            return result

    @staticmethod
    def _envelope(connection, draft_id, document, after_revision):
        rows = connection.execute("""SELECT * FROM component_draft_changes
            WHERE draft_id = ? AND revision > ? AND revision <= ? ORDER BY revision DESC LIMIT 51""",
            (draft_id, after_revision, document.revision)).fetchall()
        return {**envelope(draft_id, document), "changesTruncated": len(rows) > 50, "changes": [
            {"actor": row["actor"], "fromRevision": row["revision"] - 1, "revision": row["revision"],
             "createdAt": row["created_at"], "items": json.loads(row["items"])} for row in reversed(rows[:50])
        ]}

    @staticmethod
    def _read(connection, draft_id: str) -> ComponentDocument:
        row = connection.execute("SELECT document FROM component_drafts WHERE id = ?", (draft_id,)).fetchone()
        if row is None:
            raise ComponentError(404, "DRAFT_NOT_FOUND")
        return ComponentDocument.model_validate(json.loads(row["document"]))

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
