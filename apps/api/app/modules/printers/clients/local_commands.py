from __future__ import annotations

import re
import shutil
import subprocess
from dataclasses import dataclass

from ....config import settings
from ....time_utils import iso_utc, utc_now
from ..schemas import PrinterDeviceOut, PrinterDriverOut, PrinterHealth, PrinterJobOut, PrinterOut


class CupsCommandError(RuntimeError):
    pass


@dataclass
class CommandResult:
    ok: bool
    stdout: str
    stderr: str


STATUS_LABELS = {
    "idle": "Disponível",
    "printing": "Imprimindo",
    "stopped": "Parada",
    "disabled": "Desabilitada",
    "unknown": "Indisponível",
}


class LocalCommandsPrinterClient:
    server = "local"

    def __init__(self, timeout_seconds: int = 4) -> None:
        self.timeout_seconds = timeout_seconds

    def health(self) -> PrinterHealth:
        checked_at = self._now()
        if not settings.cups_enabled:
            return PrinterHealth(
                enabled=False,
                backend=settings.cups_backend,
                available=False,
                server=self.server,
                message="Módulo CUPS desabilitado por configuração.",
                checked_at=checked_at,
            )
        if not shutil.which("lpstat"):
            return PrinterHealth(
                enabled=True,
                backend=settings.cups_backend,
                available=False,
                server=self.server,
                message="Comando lpstat não encontrado nesta máquina.",
                checked_at=checked_at,
            )
        result = self._run("lpstat", "-r", check=False)
        if result.ok:
            return PrinterHealth(
                enabled=True,
                backend=settings.cups_backend,
                available=True,
                server=self.server,
                message="CUPS local acessível.",
                checked_at=checked_at,
            )
        return PrinterHealth(
            enabled=True,
            backend=settings.cups_backend,
            available=False,
            server=self.server,
            message=self._friendly_error(result.stderr or result.stdout),
            checked_at=checked_at,
        )

    def list_printers(self) -> list[PrinterOut]:
        self._ensure_available()
        checked_at = self._now()
        printer_status = self._parse_printers(self._run("lpstat", "-p").stdout)
        devices = self._parse_devices(self._run("lpstat", "-v", check=False).stdout)
        accepting = self._parse_accepting(self._run("lpstat", "-a", check=False).stdout)
        jobs = self.list_jobs()
        job_counts: dict[str, int] = {}
        for job in jobs:
            job_counts[job.printer_name] = job_counts.get(job.printer_name, 0) + 1
        default_printer = self._parse_default(self._run("lpstat", "-d", check=False).stdout)

        return [
            PrinterOut(
                name=name,
                status=data["status"],
                status_label=STATUS_LABELS.get(data["status"], STATUS_LABELS["unknown"]),
                enabled=data["enabled"],
                accepting_jobs=accepting.get(name, data["enabled"]),
                device_uri=devices.get(name, ""),
                jobs_count=job_counts.get(name, 0),
                is_default=name == default_printer,
                last_checked_at=checked_at,
            )
            for name, data in sorted(printer_status.items())
        ]

    def list_jobs(self) -> list[PrinterJobOut]:
        self._ensure_available()
        result = self._run("lpstat", "-W", "not-completed", "-o", check=False)
        if not result.ok:
            return []
        return [self._parse_job_line(line) for line in result.stdout.splitlines() if line.strip()]

    def list_devices(self) -> list[PrinterDeviceOut]:
        self._ensure_available()
        result = self._run("lpinfo", "-v", check=False)
        if not result.ok:
            return []
        return [self._parse_device_line(line) for line in result.stdout.splitlines() if line.strip()]

    def list_drivers(self) -> list[PrinterDriverOut]:
        self._ensure_available()
        result = self._run("lpinfo", "-m", check=False)
        if not result.ok:
            return []
        return [self._parse_driver_line(line) for line in result.stdout.splitlines() if line.strip()]

    def enable_printer(self, printer_name: str) -> None:
        self._run("cupsenable", printer_name)

    def disable_printer(self, printer_name: str) -> None:
        self._run("cupsdisable", printer_name)

    def accept_printer(self, printer_name: str) -> None:
        self._run("cupsaccept", printer_name)

    def reject_printer(self, printer_name: str) -> None:
        self._run("cupsreject", printer_name)

    def purge_printer(self, printer_name: str) -> None:
        self._run("cancel", "-a", printer_name)

    def set_default_printer(self, printer_name: str) -> None:
        self._run("lpadmin", "-d", printer_name)

    def cancel_job(self, job_id: str) -> None:
        self._run("cancel", job_id)

    def hold_job(self, job_id: str) -> None:
        self._run("lp", "-i", job_id, "-H", "hold")

    def release_job(self, job_id: str) -> None:
        self._run("lp", "-i", job_id, "-H", "resume")

    def restart_job(self, job_id: str) -> None:
        self._run("lp", "-i", job_id, "-H", "restart")

    def move_job(self, job_id: str, target_printer: str) -> None:
        self._run("lpmove", job_id, target_printer)

    def _ensure_available(self) -> None:
        health = self.health()
        if not health.available:
            raise CupsCommandError(health.message)

    def _run(self, *args: str, check: bool = True) -> CommandResult:
        try:
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except FileNotFoundError as exc:
            if check:
                raise CupsCommandError(f"Comando {args[0]} não encontrado.") from exc
            return CommandResult(False, "", f"Comando {args[0]} não encontrado.")
        except subprocess.TimeoutExpired as exc:
            if check:
                raise CupsCommandError("Tempo limite ao consultar o CUPS local.") from exc
            return CommandResult(False, exc.stdout or "", exc.stderr or "Tempo limite ao consultar o CUPS local.")

        command_result = CommandResult(result.returncode == 0, result.stdout.strip(), result.stderr.strip())
        if check and not command_result.ok:
            raise CupsCommandError(self._friendly_error(command_result.stderr or command_result.stdout))
        return command_result

    def _parse_printers(self, output: str) -> dict[str, dict[str, object]]:
        printers: dict[str, dict[str, object]] = {}
        for line in output.splitlines():
            match = re.match(r"^(?:printer|impressora)\s+(\S+)\s+(.*)$", line.strip(), flags=re.IGNORECASE)
            if not match:
                continue
            name, tail = match.groups()
            lower_tail = tail.lower()
            enabled = "disabled" not in lower_tail and "desabilitada" not in lower_tail
            if "is idle" in lower_tail or "está inativa" in lower_tail:
                status = "idle"
            elif "now printing" in lower_tail or "printing" in lower_tail or "imprimindo" in lower_tail:
                status = "printing"
            elif "disabled" in lower_tail or "stopped" in lower_tail or "desabilitada" in lower_tail or "parada" in lower_tail:
                status = "disabled"
            else:
                status = "unknown"
            printers[name] = {"status": status, "enabled": enabled}
        return printers

    def _parse_devices(self, output: str) -> dict[str, str]:
        devices: dict[str, str] = {}
        for line in output.splitlines():
            match = re.match(r"^(?:device for|dispositivo de)\s+(.+?):\s+(.+)$", line.strip(), flags=re.IGNORECASE)
            if match:
                devices[match.group(1)] = match.group(2)
        return devices

    def _parse_accepting(self, output: str) -> dict[str, bool]:
        accepting: dict[str, bool] = {}
        for line in output.splitlines():
            parts = line.strip().split()
            if len(parts) >= 3:
                accepting[parts[0]] = parts[1].lower() in {"accepting", "aceitando"}
        return accepting

    def _parse_default(self, output: str) -> str:
        match = re.search(r"(?:system default destination|destino padrão do sistema):\s*(\S+)", output, flags=re.IGNORECASE)
        return match.group(1) if match else ""

    def _parse_job_line(self, line: str) -> PrinterJobOut:
        parts = line.split()
        job_id = parts[0] if parts else ""
        printer_name = job_id.rsplit("-", 1)[0] if "-" in job_id else job_id
        size_bytes = None
        if len(parts) >= 3:
            try:
                size_bytes = int(parts[2])
            except ValueError:
                size_bytes = None
        return PrinterJobOut(
            id=job_id,
            printer_name=printer_name,
            owner=parts[1] if len(parts) >= 2 else "",
            size_bytes=size_bytes,
            submitted_at=" ".join(parts[3:]) if len(parts) > 3 else "",
            raw=line.strip(),
        )

    def _parse_device_line(self, line: str) -> PrinterDeviceOut:
        parts = line.split(maxsplit=1)
        return PrinterDeviceOut(
            kind=parts[0] if parts else "",
            uri=parts[1] if len(parts) > 1 else "",
            raw=line.strip(),
        )

    def _parse_driver_line(self, line: str) -> PrinterDriverOut:
        parts = line.split(maxsplit=1)
        return PrinterDriverOut(
            name=parts[0] if parts else "",
            description=parts[1] if len(parts) > 1 else "",
            raw=line.strip(),
        )

    def _friendly_error(self, message: str) -> str:
        normalized = message.strip()
        if not normalized:
            return "CUPS local indisponível."
        if "scheduler is not running" in normalized.lower():
            return "CUPS local não está em execução."
        if "bad file descriptor" in normalized.lower():
            return "Não foi possível consultar o CUPS local."
        return normalized

    def _now(self) -> str:
        return iso_utc(utc_now()) or ""
