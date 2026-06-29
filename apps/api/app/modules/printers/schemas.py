from pydantic import BaseModel, ConfigDict, Field


class PrinterHealth(BaseModel):
    enabled: bool
    backend: str
    available: bool
    server: str
    message: str
    checked_at: str


class PrinterOut(BaseModel):
    name: str
    status: str
    status_label: str
    enabled: bool
    accepting_jobs: bool
    device_uri: str = ""
    jobs_count: int = 0
    is_default: bool = False
    last_checked_at: str


class PrinterJobOut(BaseModel):
    id: str
    printer_name: str
    owner: str = ""
    size_bytes: int | None = None
    submitted_at: str = ""
    raw: str = ""


class PrinterDetailOut(PrinterOut):
    jobs: list[PrinterJobOut] = Field(default_factory=list)


class PrinterListOut(BaseModel):
    printers: list[PrinterOut]
    checked_at: str


class PrinterJobsOut(BaseModel):
    jobs: list[PrinterJobOut]
    checked_at: str


class PrinterError(BaseModel):
    detail: str
    model_config = ConfigDict(extra="forbid")
