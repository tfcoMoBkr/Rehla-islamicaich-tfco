from fastapi.testclient import TestClient

from app import __version__
from app.main import app


def test_health_reports_service_name_and_version() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"service": "rehla-ai", "version": __version__, "status": "ok"}
