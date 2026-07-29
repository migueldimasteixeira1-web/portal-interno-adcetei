"""add inventory_return_terms and inventory_return_term_items tables

Revision ID: 20260729_0004
Revises: 20260728_0003
Create Date: 2026-07-29 15:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260729_0004"
down_revision = "20260728_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_return_terms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("term_number", sa.String(length=40), nullable=False),
        sa.Column("contract_id", sa.Integer(), nullable=True),
        sa.Column("contract_number", sa.String(length=120), nullable=False),
        sa.Column("related_delivery_term_id", sa.Integer(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("origin_sector_id", sa.Integer(), nullable=False),
        sa.Column("origin_unit", sa.String(length=180), nullable=False),
        sa.Column("returner_user_id", sa.Integer(), nullable=False),
        sa.Column("returner_name", sa.String(length=180), nullable=False),
        sa.Column("returner_email", sa.String(length=180), nullable=False),
        sa.Column("returner_registration", sa.String(length=80), nullable=False),
        sa.Column("returner_phone", sa.String(length=40), nullable=False),
        sa.Column("adcetei_signer_name", sa.String(length=180), nullable=False),
        sa.Column("adcetei_signer_title", sa.String(length=180), nullable=False),
        sa.Column("item_observation", sa.String(length=180), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("confirmed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["contract_id"], ["inventory_contracts.id"]),
        sa.ForeignKeyConstraint(["related_delivery_term_id"], ["inventory_delivery_terms.id"]),
        sa.ForeignKeyConstraint(["origin_sector_id"], ["inventory_sectors.id"]),
        sa.ForeignKeyConstraint(["returner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["confirmed_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inventory_return_terms_term_number"), "inventory_return_terms", ["term_number"], unique=True)
    op.create_index(op.f("ix_inventory_return_terms_contract_id"), "inventory_return_terms", ["contract_id"], unique=False)
    op.create_index(
        op.f("ix_inventory_return_terms_related_delivery_term_id"),
        "inventory_return_terms",
        ["related_delivery_term_id"],
        unique=False,
    )
    op.create_index(op.f("ix_inventory_return_terms_origin_sector_id"), "inventory_return_terms", ["origin_sector_id"], unique=False)
    op.create_index(op.f("ix_inventory_return_terms_returner_user_id"), "inventory_return_terms", ["returner_user_id"], unique=False)
    op.create_index(op.f("ix_inventory_return_terms_status"), "inventory_return_terms", ["status"], unique=False)
    op.create_index(op.f("ix_inventory_return_terms_created_at"), "inventory_return_terms", ["created_at"], unique=False)

    op.create_table(
        "inventory_return_term_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("term_id", sa.Integer(), nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("asset_type", sa.String(length=80), nullable=False),
        sa.Column("manufacturer", sa.String(length=120), nullable=False),
        sa.Column("model", sa.String(length=160), nullable=False),
        sa.Column("serial_number", sa.String(length=120), nullable=False),
        sa.Column("specification", sa.Text(), nullable=False),
        sa.Column("observation", sa.String(length=180), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["term_id"], ["inventory_return_terms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_inventory_return_term_items_asset_id"), "inventory_return_term_items", ["asset_id"], unique=False)
    op.create_index(op.f("ix_inventory_return_term_items_term_id"), "inventory_return_term_items", ["term_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_inventory_return_term_items_term_id"), table_name="inventory_return_term_items")
    op.drop_index(op.f("ix_inventory_return_term_items_asset_id"), table_name="inventory_return_term_items")
    op.drop_table("inventory_return_term_items")

    op.drop_index(op.f("ix_inventory_return_terms_created_at"), table_name="inventory_return_terms")
    op.drop_index(op.f("ix_inventory_return_terms_status"), table_name="inventory_return_terms")
    op.drop_index(op.f("ix_inventory_return_terms_returner_user_id"), table_name="inventory_return_terms")
    op.drop_index(op.f("ix_inventory_return_terms_origin_sector_id"), table_name="inventory_return_terms")
    op.drop_index(op.f("ix_inventory_return_terms_related_delivery_term_id"), table_name="inventory_return_terms")
    op.drop_index(op.f("ix_inventory_return_terms_contract_id"), table_name="inventory_return_terms")
    op.drop_index(op.f("ix_inventory_return_terms_term_number"), table_name="inventory_return_terms")
    op.drop_table("inventory_return_terms")
