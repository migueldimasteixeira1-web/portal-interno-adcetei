from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from xml.etree import ElementTree as ET

from .time_utils import SAO_PAULO, ensure_utc

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W_NS}
ET.register_namespace("w", W_NS)

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
    return ["".join(text.text or "" for text in cell.findall(".//w:t", NS)) for cell in rows[0].findall("w:tc", NS)]


def table_has_header(table: ET.Element, expected: list[str]) -> bool:
    return table.tag == w_tag("tbl") and table_header(table) == expected


def mark_table_rows_for_pagination(table: ET.Element) -> None:
    rows = table.findall("w:tr", NS)
    for index, row in enumerate(rows):
        tr_pr = ensure_child(row, "trPr", 0)
        ensure_child(tr_pr, "cantSplit")
        if index == 0:
            ensure_child(tr_pr, "tblHeader")


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


def filename_part(value: str) -> str:
    import re
    import unicodedata

    normalized = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Za-z0-9._ -]+", "-", normalized).strip(" .-")


def arrange_two_table_document(
    root: ET.Element,
    *,
    relation_heading: str,
    summary_headers: list[str],
    detail_headers: list[str],
    signature_marker: str = "________________________________",
) -> None:
    """Reflui o documento em duas páginas: conteúdo + tabela-resumo na primeira,
    tabela detalhada + assinaturas na segunda. Usado por termos de recebimento e
    de devolução, que compartilham exatamente essa estrutura de duas tabelas."""
    body = root.find("w:body", NS)
    if body is None:
        return
    children = list(body)
    section = children[-1] if children and children[-1].tag == w_tag("sectPr") else None
    content = children[:-1] if section is not None else children

    heading = next((item for item in content if paragraph_has_text(item, relation_heading)), None)
    summary_table = next((item for item in content if table_has_header(item, summary_headers)), None)
    detail_table = next((item for item in content if table_has_header(item, detail_headers)), None)
    if heading is None or summary_table is None or detail_table is None:
        return

    without_dynamic = [item for item in content if id(item) != id(detail_table)]
    signature_start = next((index for index, item in enumerate(without_dynamic) if paragraph_has_text(item, signature_marker)), None)
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
