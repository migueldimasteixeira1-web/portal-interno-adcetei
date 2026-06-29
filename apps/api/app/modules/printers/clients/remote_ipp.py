from ....config import settings
from ....time_utils import iso_utc, utc_now
from ..schemas import PrinterDeviceOut, PrinterDriverOut, PrinterHealth, PrinterJobOut, PrinterOut


class RemoteIppPrinterClient:
    def health(self) -> PrinterHealth:
        return PrinterHealth(
            enabled=settings.cups_enabled,
            backend=settings.cups_backend,
            available=False,
            server=f"{settings.cups_scheme}://{settings.cups_host}:{settings.cups_port}",
            message="Backend remote_ipp reservado para integração futura com o PrintServer.",
            checked_at=iso_utc(utc_now()) or "",
        )

    def list_printers(self) -> list[PrinterOut]:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def list_jobs(self) -> list[PrinterJobOut]:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def list_devices(self) -> list[PrinterDeviceOut]:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def list_drivers(self) -> list[PrinterDriverOut]:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def enable_printer(self, printer_name: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def disable_printer(self, printer_name: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def accept_printer(self, printer_name: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def reject_printer(self, printer_name: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def purge_printer(self, printer_name: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def set_default_printer(self, printer_name: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def cancel_job(self, job_id: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def hold_job(self, job_id: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def release_job(self, job_id: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def restart_job(self, job_id: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")

    def move_job(self, job_id: str, target_printer: str) -> None:
        raise NotImplementedError("Backend remote_ipp ainda não foi implementado.")
