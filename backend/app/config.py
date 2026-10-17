from dataclasses import dataclass, field
import os
from pathlib import Path

from dotenv import dotenv_values


PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    api_url: str = "http://127.0.0.1:8010"
    api_key: str = field(default="", repr=False)


def load_settings(root: Path = PROJECT_ROOT) -> Settings:
    # Do not mutate the process environment; an explicitly empty env value wins too.
    values = {**dotenv_values(root / ".env"), **dotenv_values(root / ".env.local"), **os.environ}
    return Settings(
        api_url=values.get("RUIWARE_TEMPLATE_API_URL") or "http://127.0.0.1:8010",
        api_key=values.get("RUIWARE_PUBLIC_API_KEY") or "",
    )
