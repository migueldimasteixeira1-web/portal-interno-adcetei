from __future__ import annotations

import sys

from sqlalchemy import func, inspect, select
from sqlalchemy.exc import SQLAlchemyError

from .database import Base, engine
from . import models  # noqa: F401


MINIMUM_DATA_TABLE = "users"


def _expected_columns() -> dict[str, set[str]]:
    return {
        table.name: {column.name for column in table.columns}
        for table in Base.metadata.sorted_tables
    }


def _expected_foreign_keys() -> dict[str, set[tuple[str, str, str]]]:
    expected: dict[str, set[tuple[str, str, str]]] = {}
    for table in Base.metadata.sorted_tables:
        table_keys: set[tuple[str, str, str]] = set()
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                table_keys.add((column.name, foreign_key.column.table.name, foreign_key.column.name))
        expected[table.name] = table_keys
    return expected


def validate_existing_schema() -> list[str]:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    expected_columns = _expected_columns()
    problems: list[str] = []

    if not existing_tables:
        return ["Banco sem tabelas: use alembic upgrade head em vez de adoção por stamp."]

    missing_tables = sorted(set(expected_columns) - existing_tables)
    for table_name in missing_tables:
        problems.append(f"Tabela ausente: {table_name}")

    for table_name, columns in sorted(expected_columns.items()):
        if table_name not in existing_tables:
            continue
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name in sorted(columns - existing_columns):
            problems.append(f"Coluna ausente: {table_name}.{column_name}")

    expected_foreign_keys = _expected_foreign_keys()
    for table_name, keys in sorted(expected_foreign_keys.items()):
        if not keys or table_name not in existing_tables:
            continue
        existing_keys = {
            (constrained, foreign_key["referred_table"], referred)
            for foreign_key in inspector.get_foreign_keys(table_name)
            for constrained, referred in zip(
                foreign_key.get("constrained_columns") or [],
                foreign_key.get("referred_columns") or [],
                strict=False,
            )
        }
        for column_name, referred_table, referred_column in sorted(keys - existing_keys):
            problems.append(
                f"Chave estrangeira ausente: {table_name}.{column_name} -> {referred_table}.{referred_column}"
            )

    if MINIMUM_DATA_TABLE in existing_tables:
        with engine.connect() as connection:
            row_count = connection.scalar(select(func.count()).select_from(Base.metadata.tables[MINIMUM_DATA_TABLE]))
        if not row_count:
            problems.append("Banco existente sem usuários: use alembic upgrade head para instalação limpa.")

    return problems


def main() -> int:
    try:
        problems = validate_existing_schema()
    except SQLAlchemyError as exc:
        print(f"Falha ao validar schema existente: {exc}", file=sys.stderr)
        return 2

    if problems:
        print("Banco não está compatível com a baseline do Alembic:", file=sys.stderr)
        for problem in problems:
            print(f"- {problem}", file=sys.stderr)
        return 1

    print("Banco compatível com a baseline. Execute o stamp manualmente se este for o banco correto.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
