from fastapi import APIRouter, Depends

from ...models import User
from ...permissions import require_permission
from .schemas import PrinterDetailOut, PrinterHealth, PrinterJobsOut, PrinterListOut
from .service import PrinterService

router = APIRouter(prefix="/api/printers", tags=["impressoras"])


def get_printer_service() -> PrinterService:
    return PrinterService()


@router.get("/health", response_model=PrinterHealth)
def printer_health(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.view")),
):
    return service.health()


@router.get("", response_model=PrinterListOut)
def list_printers(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.view")),
):
    printers = service.list_printers()
    checked_at = printers[0].last_checked_at if printers else service.health().checked_at
    return PrinterListOut(printers=printers, checked_at=checked_at)


@router.get("/jobs", response_model=PrinterJobsOut)
def list_printer_jobs(
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.jobs.view")),
):
    jobs = service.list_jobs()
    checked_at = service.health().checked_at
    return PrinterJobsOut(jobs=jobs, checked_at=checked_at)


@router.get("/{printer_name}", response_model=PrinterDetailOut)
def get_printer(
    printer_name: str,
    service: PrinterService = Depends(get_printer_service),
    current_user: User = Depends(require_permission("printers.view")),
):
    return service.get_printer(printer_name)
