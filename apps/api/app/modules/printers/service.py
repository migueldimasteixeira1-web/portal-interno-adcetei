from fastapi import HTTPException

from ...config import settings
from .clients.base import PrinterClient
from .clients.local_commands import CupsCommandError, LocalCommandsPrinterClient
from .clients.remote_ipp import RemoteIppPrinterClient
from .schemas import (
    PrinterActionIn,
    PrinterActionOut,
    PrinterDetailOut,
    PrinterDeviceOut,
    PrinterDriverOut,
    PrinterEventOut,
    PrinterHealth,
    PrinterJobOut,
    PrinterOut,
)


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

    def get_printer_jobs(self, printer_name: str) -> list[PrinterJobOut]:
        self._find_printer(printer_name)
        return [job for job in self.list_jobs() if job.printer_name == printer_name]

    def snapshot(self) -> PrinterEventOut:
        health = self.health()
        printers = self.list_printers() if health.available else []
        jobs = self.list_jobs() if health.available else []
        return PrinterEventOut(health=health, printers=printers, jobs=jobs, checked_at=health.checked_at)

    def list_devices(self) -> list[PrinterDeviceOut]:
        self._ensure_enabled()
        try:
            return self.client.list_devices()
        except (CupsCommandError, NotImplementedError) as exc:
            raise HTTPException(status_code=503, detail=str(exc) or "Dispositivos CUPS indisponíveis.") from exc

    def list_drivers(self) -> list[PrinterDriverOut]:
        self._ensure_enabled()
        try:
            return self.client.list_drivers()
        except (CupsCommandError, NotImplementedError) as exc:
            raise HTTPException(status_code=503, detail=str(exc) or "Drivers CUPS indisponíveis.") from exc

    def enable_printer(self, printer_name: str, payload: PrinterActionIn) -> PrinterActionOut:
        return self._printer_action("enable", printer_name, payload, self.client.enable_printer, "Impressora habilitada.")

    def disable_printer(self, printer_name: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        return self._printer_action("disable", printer_name, payload, self.client.disable_printer, "Impressora desabilitada.")

    def accept_printer(self, printer_name: str, payload: PrinterActionIn) -> PrinterActionOut:
        return self._printer_action("accept", printer_name, payload, self.client.accept_printer, "Fila aceitando novos jobs.")

    def reject_printer(self, printer_name: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        return self._printer_action("reject", printer_name, payload, self.client.reject_printer, "Fila rejeitando novos jobs.")

    def purge_printer(self, printer_name: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        return self._printer_action("purge", printer_name, payload, self.client.purge_printer, "Jobs da impressora cancelados.")

    def set_default_printer(self, printer_name: str, payload: PrinterActionIn) -> PrinterActionOut:
        return self._printer_action("set_default", printer_name, payload, self.client.set_default_printer, "Impressora definida como padrão.")

    def cancel_job(self, job_id: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        return self._job_action("cancel", job_id, payload, self.client.cancel_job, "Job cancelado.")

    def hold_job(self, job_id: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        return self._job_action("hold", job_id, payload, self.client.hold_job, "Job retido.")

    def release_job(self, job_id: str, payload: PrinterActionIn) -> PrinterActionOut:
        return self._job_action("release", job_id, payload, self.client.release_job, "Job liberado.")

    def restart_job(self, job_id: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        return self._job_action("restart", job_id, payload, self.client.restart_job, "Job reiniciado.")

    def move_job(self, job_id: str, payload: PrinterActionIn) -> PrinterActionOut:
        self._require_confirmed_reason(payload)
        target = payload.target_printer.strip()
        if not target:
            raise HTTPException(status_code=422, detail="Informe a impressora de destino.")
        self._find_printer(target)
        return self._job_action(
            "move",
            job_id,
            payload,
            lambda current_job_id: self.client.move_job(current_job_id, target),
            "Job movido.",
        )

    def _printer_action(self, action: str, printer_name: str, payload: PrinterActionIn, operation, message: str) -> PrinterActionOut:
        before = self._find_printer(printer_name)
        try:
            operation(printer_name)
        except (CupsCommandError, NotImplementedError) as exc:
            raise HTTPException(status_code=503, detail=str(exc) or "Não foi possível executar a ação no CUPS.") from exc
        after = self._find_printer(printer_name, required=False)
        return PrinterActionOut(
            ok=True,
            action=action,
            entity_type="printer",
            entity_id=printer_name,
            message=message,
            before=before.model_dump(),
            after=after.model_dump() if after else None,
            checked_at=self.health().checked_at,
        )

    def _job_action(self, action: str, job_id: str, payload: PrinterActionIn, operation, message: str) -> PrinterActionOut:
        before = self._find_job(job_id)
        try:
            operation(job_id)
        except (CupsCommandError, NotImplementedError) as exc:
            raise HTTPException(status_code=503, detail=str(exc) or "Não foi possível executar a ação no CUPS.") from exc
        after = self._find_job(job_id, required=False)
        return PrinterActionOut(
            ok=True,
            action=action,
            entity_type="printer_job",
            entity_id=job_id,
            message=message,
            before=before.model_dump(),
            after=after.model_dump() if after else None,
            checked_at=self.health().checked_at,
        )

    def _find_printer(self, printer_name: str, required: bool = True) -> PrinterOut | None:
        normalized = printer_name.strip()
        printer = next((item for item in self.list_printers() if item.name == normalized), None)
        if required and not printer:
            raise HTTPException(status_code=404, detail="Impressora não encontrada no CUPS.")
        return printer

    def _find_job(self, job_id: str, required: bool = True) -> PrinterJobOut | None:
        normalized = job_id.strip()
        job = next((item for item in self.list_jobs() if item.id == normalized), None)
        if required and not job:
            raise HTTPException(status_code=404, detail="Job não encontrado no CUPS.")
        return job

    def _require_confirmed_reason(self, payload: PrinterActionIn) -> None:
        if not payload.confirm:
            raise HTTPException(status_code=422, detail="Confirme explicitamente a ação.")
        if not payload.reason.strip():
            raise HTTPException(status_code=422, detail="Informe o motivo da ação.")

    def _ensure_enabled(self) -> None:
        if not settings.cups_enabled:
            raise HTTPException(status_code=503, detail="Módulo CUPS desabilitado por configuração.")
