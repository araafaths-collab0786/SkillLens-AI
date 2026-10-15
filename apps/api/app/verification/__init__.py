"""
Shared types for screening pipeline steps.
"""
from dataclasses import dataclass, field
from typing import Any, Literal


StepStatus = Literal["passed", "warning", "failed"]


@dataclass
class StepResult:
    step: str
    status: StepStatus
    flags: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "status": self.status,
            "flags": self.flags,
            "metrics": self.metrics,
        }
