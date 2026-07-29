from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

from .docx_utils import (
    NS,
    arrange_two_table_document,
    filename_part,
    format_term_date,
    mark_table_rows_for_pagination,
    replace_table_rows,
    set_text,
)
from .models import InventoryReturnTerm

TEMPLATE_PATH = Path(__file__).with_name("templates") / "termo-devolucao-template.docx"


def term_filename(term: InventoryReturnTerm) -> str:
    number = filename_part(term.term_number) or str(term.id)
    returner = filename_part(term.returner_name) or "Devolvedor"
    return f"{number} - Termo de Devolução - {returner}.docx"


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(text.text or "" for text in paragraph.findall(".//w:t", NS))


def declaration_sentence(term: InventoryReturnTerm) -> str:
    sentence = (
        "Declaro, para os devidos fins, que estou devolvendo à Secretaria Adjunta de Ciência e "
        "Tecnologia (ADCETEI) o(s) equipamento(s) de informática abaixo relacionado(s)"
    )
    if term.contract_number.strip():
        sentence += f", vinculado(s) ao {term.contract_number.strip()}"
    if term.related_delivery_term and term.related_delivery_term.term_number:
        sentence += (
            ", referente ao Termo de Recebimento e Responsabilidade nº "
            f"{term.related_delivery_term.term_number}"
        )
    sentence += (
        ", encontrando-se em perfeito estado de conservação e funcionamento, ressalvado o "
        "desgaste natural do uso regular."
    )
    return sentence


def replace_paragraph_text(root: ET.Element, replacements: dict[str, str]) -> None:
    for paragraph in root.findall(".//w:p", NS):
        content = paragraph_text(paragraph)
        if not content:
            continue
        if "E-mail" in content and "Matrícula" in content and "Telefone" in content:
            set_text(
                paragraph,
                f"E-mail {replacements['Erica.Sanches@adppe.cabofrio.rj.gov.br']}    "
                f"Matrícula: {replacements['250401573']}    "
                f"Telefone: {replacements['22-981221739']}",
            )
            continue
        if content.startswith("Declaro, para os devidos fins, que estou devolvendo"):
            set_text(paragraph, replacements["__declaration__"])
            continue
        updated = content
        for old, new in replacements.items():
            if old == "__declaration__":
                continue
            updated = updated.replace(old, new)
        if updated != content:
            set_text(paragraph, updated)


def summary_rows(term: InventoryReturnTerm) -> list[list[str]]:
    grouped: dict[tuple[str, str, str], int] = {}
    for item in term.items:
        key = (item.asset_type, item.specification, item.observation)
        grouped[key] = grouped.get(key, 0) + 1
    return [
        [str(index), asset_type, specification, str(quantity), observation]
        for index, ((asset_type, specification, observation), quantity) in enumerate(grouped.items(), start=1)
    ]


def detail_rows(term: InventoryReturnTerm) -> list[list[str]]:
    return [
        [
            str(index),
            item.asset_type,
            item.manufacturer,
            item.model,
            item.serial_number,
            "",
        ]
        for index, item in enumerate(term.items, start=1)
    ]


def render_return_term_docx(term: InventoryReturnTerm) -> bytes:
    with ZipFile(TEMPLATE_PATH) as source:
        document_xml = source.read("word/document.xml")
        root = ET.fromstring(document_xml)

        replacements = {
            "001/2026": term.term_number,
            "Contrato nº 046/2026 – PMCF / IART": term.contract_number,
            "Cabo Frio, 26 de junho de 2026": format_term_date(term.issued_at),
            "SGI – SUPERVISÃO EXECUTIVA": term.origin_unit,
            "Érica Sanches": term.returner_name,
            "Erica.Sanches@adppe.cabofrio.rj.gov.br": term.returner_email,
            "250401573": term.returner_registration,
            "22-981221739": term.returner_phone,
            "William Barreto Corrêa": term.adcetei_signer_name,
            "Coordenador Geral de Tecnologia da Informação": term.adcetei_signer_title,
            "__declaration__": declaration_sentence(term),
        }
        replace_paragraph_text(root, replacements)

        tables = root.findall(".//w:tbl", NS)
        if len(tables) >= 2:
            summary_template = tables[0].findall("w:tr", NS)[1]
            detail_template = tables[1].findall("w:tr", NS)[1]
            replace_table_rows(tables[0], summary_template, summary_rows(term))
            replace_table_rows(tables[1], detail_template, detail_rows(term))
            mark_table_rows_for_pagination(tables[0])
            mark_table_rows_for_pagination(tables[1])
            arrange_two_table_document(
                root,
                relation_heading="Relação dos equipamentos devolvidos",
                summary_headers=["Item", "Tipo", "Modelo / Especificação", "Quantidade", "Observações"],
                detail_headers=["UN", "Categoria", "Marca", "Modelo", "Série", "Obs"],
            )

        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as target:
            for item in source.infolist():
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True) if item.filename == "word/document.xml" else source.read(item.filename)
                target.writestr(item, data)
        return output.getvalue()
