from typing import Protocol

from ..schemas import PrinterHealth, PrinterJobOut, PrinterOut


class PrinterClient(Protocol):
    def health(self) -> PrinterHealth:
        ...

    def list_printers(self) -> list[PrinterOut]:
        ...

    def list_jobs(self) -> list[PrinterJobOut]:
        ...
