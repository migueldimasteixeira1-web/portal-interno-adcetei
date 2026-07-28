"""add chat_messages table for internal direct messaging

Revision ID: 20260728_0003
Revises: 20260724_0002
Create Date: 2026-07-28 16:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260728_0003"
down_revision = "20260724_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_sender_id"), "chat_messages", ["sender_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_recipient_id"), "chat_messages", ["recipient_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_created_at"), "chat_messages", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_messages_created_at"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_recipient_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_sender_id"), table_name="chat_messages")
    op.drop_table("chat_messages")
