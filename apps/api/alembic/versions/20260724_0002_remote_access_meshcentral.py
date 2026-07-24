"""add remote access meshcentral integration tables

Revision ID: 20260724_0002
Revises: 20260717_0001
Create Date: 2026-07-24 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260724_0002"
down_revision = "20260717_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "remote_device_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=True),
        sa.Column("mesh_node_id", sa.String(length=160), nullable=False),
        sa.Column("mesh_group_id", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("device_name_snapshot", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mesh_node_id", name="uq_remote_device_links_mesh_node_id"),
    )
    op.create_index(op.f("ix_remote_device_links_asset_id"), "remote_device_links", ["asset_id"], unique=False)
    op.create_index(op.f("ix_remote_device_links_created_at"), "remote_device_links", ["created_at"], unique=False)
    op.create_index(op.f("ix_remote_device_links_mesh_group_id"), "remote_device_links", ["mesh_group_id"], unique=False)
    op.create_index(op.f("ix_remote_device_links_mesh_node_id"), "remote_device_links", ["mesh_node_id"], unique=False)

    op.create_table(
        "remote_access_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("portal_user_id", sa.Integer(), nullable=False),
        sa.Column("mesh_user_id", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("mesh_node_id", sa.String(length=160), nullable=False),
        sa.Column("mesh_group_id", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("asset_id", sa.Integer(), nullable=True),
        sa.Column("ticket_id", sa.Integer(), nullable=True),
        sa.Column("device_name_snapshot", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("access_mode", sa.String(length=30), nullable=False, server_default="desktop"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="authorized"),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("authorized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_ip", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("failure_reason", sa.Text(), nullable=False, server_default=""),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["portal_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_remote_access_sessions_asset_id"), "remote_access_sessions", ["asset_id"], unique=False)
    op.create_index(op.f("ix_remote_access_sessions_mesh_group_id"), "remote_access_sessions", ["mesh_group_id"], unique=False)
    op.create_index(op.f("ix_remote_access_sessions_mesh_node_id"), "remote_access_sessions", ["mesh_node_id"], unique=False)
    op.create_index(op.f("ix_remote_access_sessions_portal_user_id"), "remote_access_sessions", ["portal_user_id"], unique=False)
    op.create_index(op.f("ix_remote_access_sessions_requested_at"), "remote_access_sessions", ["requested_at"], unique=False)
    op.create_index(op.f("ix_remote_access_sessions_status"), "remote_access_sessions", ["status"], unique=False)
    op.create_index(op.f("ix_remote_access_sessions_ticket_id"), "remote_access_sessions", ["ticket_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_remote_access_sessions_ticket_id"), table_name="remote_access_sessions")
    op.drop_index(op.f("ix_remote_access_sessions_status"), table_name="remote_access_sessions")
    op.drop_index(op.f("ix_remote_access_sessions_requested_at"), table_name="remote_access_sessions")
    op.drop_index(op.f("ix_remote_access_sessions_portal_user_id"), table_name="remote_access_sessions")
    op.drop_index(op.f("ix_remote_access_sessions_mesh_node_id"), table_name="remote_access_sessions")
    op.drop_index(op.f("ix_remote_access_sessions_mesh_group_id"), table_name="remote_access_sessions")
    op.drop_index(op.f("ix_remote_access_sessions_asset_id"), table_name="remote_access_sessions")
    op.drop_table("remote_access_sessions")

    op.drop_index(op.f("ix_remote_device_links_mesh_node_id"), table_name="remote_device_links")
    op.drop_index(op.f("ix_remote_device_links_mesh_group_id"), table_name="remote_device_links")
    op.drop_index(op.f("ix_remote_device_links_created_at"), table_name="remote_device_links")
    op.drop_index(op.f("ix_remote_device_links_asset_id"), table_name="remote_device_links")
    op.drop_table("remote_device_links")
