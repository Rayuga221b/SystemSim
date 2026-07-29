"""AiMessage — one turn of the floating global AI assistant (services/chat.py).

Auth-gated by design: POST /ai/chat requires get_current_user, so every row
is attributable to a user. That attribution is what makes the DB-backed rate
limit in services/chat.py possible at all — an anonymous endpoint would have
no identity to count against. See docs/RAG.md "The floating assistant".

Role pairs (user, assistant) share context_type/context_slug so history()
can scope replay to "this case study" / "the sandbox" / general — switching
pages shows the relevant thread instead of one global undifferentiated log.
"""
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class AiMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # "case_study" | "sandbox" | "roadmap" | "general". context_slug is the
    # case-study or roadmap-lesson slug when context_type is one of those,
    # else null.
    context_type: Mapped[str] = mapped_column(String, nullable=False, default="general", index=True)
    context_slug: Mapped[str | None] = mapped_column(String, nullable=True)

    # Assistant-only: retrieval metadata for this reply, mirrors POST /ai/mentor.
    sources: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    grounded: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    owner: Mapped["User"] = relationship("User", back_populates="ai_messages")  # type: ignore[name-defined]
