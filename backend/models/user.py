import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.design import Design
    from models.challenge_attempt import ChallengeAttempt
    from models.ai_message import AiMessage


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    designs: Mapped[list["Design"]] = relationship("Design", back_populates="owner", cascade="all, delete-orphan")
    challenge_attempts: Mapped[list["ChallengeAttempt"]] = relationship("ChallengeAttempt", back_populates="owner", cascade="all, delete-orphan")
    ai_messages: Mapped[list["AiMessage"]] = relationship("AiMessage", back_populates="owner", cascade="all, delete-orphan")
