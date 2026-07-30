import requests

from app.config import settings

BASE_URL = settings.supabase_url.rstrip("/") + "/rest/v1"
HEADERS = {
    "apikey": settings.supabase_service_key,
    "Authorization": f"Bearer {settings.supabase_service_key}",
    "Content-Type": "application/json",
}
TIMEOUT = 20
# Supabase's free tier can have a slow/cold first request; retry once on a
# transient network hiccup rather than surfacing it straight to the user.
RETRYABLE = (requests.exceptions.Timeout, requests.exceptions.ConnectionError)


def _request(method: str, url: str, **kwargs) -> requests.Response:
    try:
        resp = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    except RETRYABLE:
        resp = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    resp.raise_for_status()
    return resp


def insert(table: str, row: dict) -> dict:
    headers = {**HEADERS, "Prefer": "return=representation"}
    resp = _request("post", f"{BASE_URL}/{table}", headers=headers, json=row)
    return resp.json()[0]


def update(table: str, filters: dict, values: dict) -> list:
    params = {f"{k}": f"eq.{v}" for k, v in filters.items()}
    headers = {**HEADERS, "Prefer": "return=representation"}
    resp = _request("patch", f"{BASE_URL}/{table}", headers=headers, params=params, json=values)
    return resp.json()


def rpc(fn_name: str, params: dict) -> list:
    resp = _request("post", f"{BASE_URL}/rpc/{fn_name}", headers=HEADERS, json=params)
    return resp.json() if resp.content else []


def select(table: str, filters: dict, order: str | None = None, limit: int | None = None) -> list:
    params = {f"{k}": f"eq.{v}" for k, v in filters.items()}
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    resp = _request("get", f"{BASE_URL}/{table}", headers=HEADERS, params=params)
    return resp.json()


def delete(table: str, filters: dict) -> None:
    params = {f"{k}": f"eq.{v}" for k, v in filters.items()}
    _request("delete", f"{BASE_URL}/{table}", headers=HEADERS, params=params)
