"""The referral bodies a referral names, by id only.

The ingest copies the ids of content/referral-centers.json beside the index, national channel
first. The web renders each body from that same file, so the model and the service never write a
name, a number or an address. Which bodies to show near the learner is decided on the device, from
the city the learner chose; the service never learns it.
"""

import json
from functools import lru_cache
from pathlib import Path

from app.config import get_settings

FILE = "referral-centers.json"
SPECIALIST_PAGE = "/talk-to-a-specialist"


@lru_cache
def _ids(index_dir: Path) -> tuple[str, ...]:
    path = index_dir / FILE
    if not path.exists():
        return ()
    ids: list[str] = json.loads(path.read_text(encoding="utf-8"))["ids"]
    return tuple(ids)


def referral_centres(index_dir: Path | None = None) -> list[str]:
    return list(_ids(index_dir or get_settings().index_dir))
