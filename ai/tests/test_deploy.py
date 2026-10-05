"""What deployment relies on: ai/data prepared from content/ without a model, the shared key with
the web app's proxy, the learner's address passed through it, no browser origin allowed, and
Rafiq built only when first asked for."""

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import RateLimiter, Services, _client
from app.config import get_settings
from app.main import app
from app.prepare import INDEX_FILES, MissingFile, prepare
from app.security import CLIENT_HEADER, KEY_HEADER


@pytest.fixture
def content(tmp_path: Path) -> Path:
    root = tmp_path / "content"
    (root / "fetched").mkdir(parents=True)
    (root / "fetched" / "surahs.json").write_text(
        json.dumps({"names": {"1": {"en": "Al-Fatihah"}}})
    )
    centres = [
        {"id": "assoc", "type": "association"},
        {"id": "national", "type": "nationalChannel"},
    ]
    (root / "referral-centers.json").write_text(json.dumps({"centers": centres}))
    return root


@pytest.fixture
def index(tmp_path: Path) -> Path:
    directory = tmp_path / "index"
    directory.mkdir()
    for name in INDEX_FILES:
        (directory / name).write_text("")
    return directory


def test_prepare_copies_what_the_service_reads_at_runtime(content: Path, index: Path) -> None:
    files = prepare(content, index)

    assert {"surahs.json", "referral-centers.json", *INDEX_FILES} <= set(files)
    assert json.loads((index / "referral-centers.json").read_text())["ids"] == ["national", "assoc"]


def test_prepare_names_the_missing_file(content: Path, index: Path) -> None:
    (content / "referral-centers.json").unlink()
    with pytest.raises(MissingFile, match=r"referral-centers.json"):
        prepare(content, index)

    (index / "vectors.npy").unlink()
    (content / "referral-centers.json").write_text(json.dumps({"centers": []}))
    with pytest.raises(MissingFile, match=r"vectors.npy"):
        prepare(content, index)


@pytest.fixture
def keyed(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("AI_SERVICE_KEY", "s3cret")
    get_settings.cache_clear()
    with TestClient(app) as client:
        yield client
    get_settings.cache_clear()


def test_with_a_key_set_only_requests_carrying_it_are_served(keyed: TestClient) -> None:
    assert keyed.get("/health").status_code == 401
    assert keyed.get("/health", headers={KEY_HEADER: "wrong"}).status_code == 401
    assert keyed.post("/ask", json={}).json() == {"error": {"code": "unauthorized"}}
    assert keyed.get("/health", headers={KEY_HEADER: "s3cret"}).status_code == 200


def test_without_a_key_set_every_request_is_served(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AI_SERVICE_KEY", raising=False)
    get_settings.cache_clear()
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200


def test_no_browser_origin_is_allowed() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/ask",
            headers={"Origin": "https://example.org", "Access-Control-Request-Method": "POST"},
        )
    assert "access-control-allow-origin" not in response.headers


def test_the_learners_address_from_the_proxy_counts_only_with_the_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Request:
        def __init__(self, headers: dict[str, str]) -> None:
            self.headers = headers
            self.client = None

    proxied = Request({CLIENT_HEADER: "203.0.113.9", "x-forwarded-for": "198.51.100.1"})
    monkeypatch.delenv("AI_SERVICE_KEY", raising=False)
    get_settings.cache_clear()
    assert _client(proxied) == "198.51.100.1"  # type: ignore[arg-type]
    monkeypatch.setenv("AI_SERVICE_KEY", "s3cret")
    get_settings.cache_clear()
    assert _client(proxied) == "203.0.113.9"  # type: ignore[arg-type]
    get_settings.cache_clear()


def test_rafiq_is_built_once_on_first_use_not_at_startup() -> None:
    calls = []

    def load() -> None:
        calls.append(1)

    services = Services(limiter=RateLimiter(1), load=load)
    assert calls == []
    services.get()
    services.get()
    assert calls == [1]
