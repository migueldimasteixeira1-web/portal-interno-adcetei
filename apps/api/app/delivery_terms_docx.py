from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from io import BytesIO
from pathlib import Path
import re
import unicodedata
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

from .models import InventoryDeliveryTerm
from .time_utils import SAO_PAULO, ensure_utc

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W_NS}
ET.register_namespace("w", W_NS)

TEMPLATE_PATH = Path(__file__).with_name("templates") / "termo-recebimento-template.docx"

MONTHS_PT = [
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
]


def term_filename(term: InventoryDeliveryTerm) -> str:
    number = filename_part(term.term_number) or str(term.id)
    recipient = filename_part(term.recipient_name) or "Recebedor"
    return f"{number} - Termo de Recebimento - {recipient}.docx"


def filename_part(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Za-z0-9._ -]+", "-", normalized).strip(" .-")


def format_term_date(value: datetime) -> str:
    normalized = ensure_utc(value) or value
    local = normalized.astimezone(SAO_PAULO)
    return f"Cabo Frio, {local.day} de {MONTHS_PT[local.month]} de {local.year}"


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(text.text or "" for text in paragraph.findall(".//w:t", NS))


def set_text(container: ET.Element, value: str) -> None:
    texts = container.findall(".//w:t", NS)
    if not texts:
        return
    texts[0].set(f"{{{XML_NS}}}space", "preserve")
    texts[0].text = value
    for text in texts[1:]:
        text.text = ""


def w_tag(name: str) -> str:
    return f"{{{W_NS}}}{name}"


def child(parent: ET.Element, name: str) -> ET.Element | None:
    return parent.find(f"w:{name}", NS)


def ensure_child(parent: ET.Element, name: str, index: int | None = None) -> ET.Element:
    existing = child(parent, name)
    if existing is not None:
        return existing
    created = ET.Element(w_tag(name))
    if index is None:
        parent.append(created)
    else:
        parent.insert(index, created)
    return created


def page_break_paragraph() -> ET.Element:
    paragraph = ET.Element(w_tag("p"))
    run = ET.SubElement(paragraph, w_tag("r"))
    page_break = ET.SubElement(run, w_tag("br"))
    page_break.set(w_tag("type"), "page")
    return paragraph


def empty_paragraph() -> ET.Element:
    return ET.Element(w_tag("p"))


def paragraph_has_text(element: ET.Element, expected: str) -> bool:
    return element.tag == w_tag("p") and paragraph_text(element).strip() == expected


def is_empty_paragraph(element: ET.Element) -> bool:
    return element.tag == w_tag("p") and not paragraph_text(element).strip() and not element.findall(".//w:br", NS)


def trim_empty_paragraphs(items: list[ET.Element]) -> list[ET.Element]:
    trimmed = list(items)
    while trimmed and is_empty_paragraph(trimmed[-1]):
        trimmed.pop()
    return trimmed


def table_header(table: ET.Element) -> list[str]:
    rows = table.findall("w:tr", NS)
    if not rows:
        return []
    return ["".join(text.text or "" for text in cell.findall(".//w:t", NS)).strip() for cell in rows[0].findall("w:tc", NS)]


def table_has_header(table: ET.Element, expected: list[str]) -> bool:
    return table.tag == w_tag("tbl") and table_header(table) == expected


def mark_table_rows_for_pagination(table: ET.Element) -> None:
    rows = table.findall("w:tr", NS)
    for index, row in enumerate(rows):
        tr_pr = ensure_child(row, "trPr", 0)
        ensure_child(tr_pr, "cantSplit")
        if index == 0:
            ensure_child(tr_pr, "tblHeader")


def arrange_document_sections(root: ET.Element) -> None:
    body = root.find("w:body", NS)
    if body is None:
        return
    children = list(body)
    section = children[-1] if children and children[-1].tag == w_tag("sectPr") else None
    content = children[:-1] if section is not None else children

    relation_heading = next((item for item in content if paragraph_has_text(item, "Relação dos equipamentos recebidos")), None)
    summary_table = next((item for item in content if table_has_header(item, ["Item", "Tipo", "Modelo / Especificação", "Quantidade", "Observações"])), None)
    detail_table = next((item for item in content if table_has_header(item, ["UN", "Categoria", "Marca", "Modelo", "Série", "Obs"])), None)
    if relation_heading is None or summary_table is None or detail_table is None:
        return

    signature_start = next((index for index, item in enumerate(content) if paragraph_has_text(item, "________________________________")), None)
    if signature_start is None:
        return

    without_dynamic = [item for item in content if id(item) != id(detail_table)]
    signature_start = next((index for index, item in enumerate(without_dynamic) if paragraph_has_text(item, "________________________________")), None)
    if signature_start is None:
        return
    main_content = trim_empty_paragraphs(without_dynamic[:signature_start])
    signature_block = without_dynamic[signature_start:]
    signature_spacing = [empty_paragraph() for _ in range(5)]
    reordered = main_content + [page_break_paragraph(), detail_table, *signature_spacing, *signature_block]

    body.clear()
    for item in reordered:
        body.append(item)
    if section is not None:
        body.append(section)


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
        updated = content
        for old, new in replacements.items():
            updated = updated.replace(old, new)
        if updated != content:
            set_text(paragraph, updated)


def item_condition_sentence(term: InventoryDeliveryTerm) -> str:
    observations = {item.observation.strip().lower() for item in term.items if item.observation.strip()}
    if any("usado" in value for value in observations) and any("novo" in value for value in observations):
        return "conforme estado individual indicado na relação"
    if any("usado" in value for value in observations):
        return "em estado de uso"
    return "novo(s) e sem uso"


def cell_text(row: ET.Element, index: int) -> str:
    cells = row.findall("w:tc", NS)
    if index >= len(cells):
        return ""
    return "".join(text.text or "" for text in cells[index].findall(".//w:t", NS))


def set_row_values(row: ET.Element, values: list[str]) -> None:
    cells = row.findall("w:tc", NS)
    for index, value in enumerate(values):
        if index < len(cells):
            set_text(cells[index], value)


def replace_table_rows(table: ET.Element, template_row: ET.Element, values: list[list[str]]) -> None:
    rows = table.findall("w:tr", NS)
    for row in rows[1:]:
        table.remove(row)
    for row_values in values:
        row = deepcopy(template_row)
        set_row_values(row, row_values)
        table.append(row)


def summary_rows(term: InventoryDeliveryTerm) -> list[list[str]]:
    grouped: dict[tuple[str, str, str], int] = {}
    for item in term.items:
        key = (item.asset_type, item.specification, item.observation)
        grouped[key] = grouped.get(key, 0) + 1
    return [
        [str(index), asset_type, specification, str(quantity), observation]
        for index, ((asset_type, specification, observation), quantity) in enumerate(grouped.items(), start=1)
    ]


def detail_rows(term: InventoryDeliveryTerm) -> list[list[str]]:
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


def render_delivery_term_docx(term: InventoryDeliveryTerm) -> bytes:
    with ZipFile(TEMPLATE_PATH) as source:
        document_xml = source.read("word/document.xml")
        root = ET.fromstring(document_xml)

        replacements = {
            "017/2026": term.term_number,
            "Contrato nº 046/2026 – PMCF / IART": term.contract_number,
            "Cabo Frio, 26 de junho de 2026": format_term_date(term.issued_at),
            "SGI – SUPERVISÃO EXECUTIVA": term.destination_unit,
            "Érica Sanches": term.recipient_name,
            "Erica.Sanches@adppe.cabofrio.rj.gov.br": term.recipient_email,
            "250401573": term.recipient_registration,
            "22-981221739": term.recipient_phone,
            "William Barreto Corrêa": term.adcetei_signer_name,
            "Coordenador Geral de Tecnologia da Informação": term.adcetei_signer_title,
            "os equipamentos de informática abaixo relacionados": "o(s) equipamento(s) de informática abaixo relacionado(s)",
            "novos e sem uso": item_condition_sentence(term),
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
            arrange_document_sections(root)

        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as target:
            for item in source.infolist():
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True) if item.filename == "word/document.xml" else source.read(item.filename)
                target.writestr(item, data)
        return output.getvalue()
