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


class PrinterActionIn(BaseModel):
    confirm: bool = False
    reason: str = Field(default="", max_length=500)
    target_printer: str = Field(default="", max_length=180)
    model_config = ConfigDict(extra="forbid")


class PrinterActionOut(BaseModel):
    ok: bool
    action: str
    entity_type: str
    entity_id: str
    message: str
    before: dict | None = None
    after: dict | None = None
    checked_at: str


class PrinterEventOut(BaseModel):
    health: PrinterHealth
    printers: list[PrinterOut]
    jobs: list[PrinterJobOut]
    checked_at: str


class PrinterDeviceOut(BaseModel):
    kind: str
    uri: str
    raw: str


class PrinterDriverOut(BaseModel):
    name: str
    description: str
    raw: str


class PrinterDevicesOut(BaseModel):
    devices: list[PrinterDeviceOut]
    checked_at: str


class PrinterDriversOut(BaseModel):
    drivers: list[PrinterDriverOut]
    checked_at: str


class PrinterError(BaseModel):
    detail: str
    model_config = ConfigDict(extra="forbid")
