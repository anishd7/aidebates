import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Turn(Base):
    __tablename__ = "turns"
    __table_args__ = (
        UniqueConstraint("debate_id", "turn_number", name="uq_turns_debate_turn"),
        Index("idx_turns_debate_turn", "debate_id", "turn_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid()
    )
    debate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False
    )
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_side: Mapped[str] = mapped_column(String(1), nullable=False)
    content: Mapped[str] = mapped_column(nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    debate = relationship("Debate", back_populates="turns")
