from ....config import settings
from ....time_utils import iso_utc, utc_now
from ..schemas import PrinterHealth, PrinterJobOut, PrinterOut


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
