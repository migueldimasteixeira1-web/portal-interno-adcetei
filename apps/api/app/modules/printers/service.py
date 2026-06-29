from fastapi import HTTPException

from ...config import settings
from .clients.base import PrinterClient
from .clients.local_commands import CupsCommandError, LocalCommandsPrinterClient
from .clients.remote_ipp import RemoteIppPrinterClient
from .schemas import PrinterDetailOut, PrinterHealth, PrinterJobOut, PrinterOut


def get_printer_client() -> PrinterClient:
    backend = settings.cups_backend.strip().lower()
    if backend == "local_commands":
        return LocalCommandsPrinterClient()
    if backend == "remote_ipp":
        return RemoteIppPrinterClient()
    return RemoteIppPrinterClient()


class PrinterService:
    def __init__(self, client: PrinterClient | None = None) -> None:
        self.client = client or get_printer_client()

    def health(self) -> PrinterHealth:
        if not settings.cups_enabled:
            return self.client.health()
        return self.client.health()

    def list_printers(self) -> list[PrinterOut]:
        self._ensure_enabled()
        try:
            return self.client.list_printers()
        except (CupsCommandError, NotImplementedError) as exc:
            raise HTTPException(status_code=503, detail=str(exc) or "CUPS indisponível.") from exc

    def list_jobs(self) -> list[PrinterJobOut]:
        self._ensure_enabled()
        try:
            return self.client.list_jobs()
        except (CupsCommandError, NotImplementedError) as exc:
            raise HTTPException(status_code=503, detail=str(exc) or "CUPS indisponível.") from exc

    def get_printer(self, printer_name: str) -> PrinterDetailOut:
        printers = self.list_printers()
        selected = next((printer for printer in printers if printer.name == printer_name), None)
        if not selected:
            raise HTTPException(status_code=404, detail="Impressora não encontrada.")
        jobs = [job for job in self.list_jobs() if job.printer_name == printer_name]
        return PrinterDetailOut(**selected.model_dump(), jobs=jobs)

    def _ensure_enabled(self) -> None:
        if not settings.cups_enabled:
            raise HTTPException(status_code=503, detail="Módulo CUPS desabilitado por configuração.")
