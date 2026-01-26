"""
ACI Client

Async HTTP client for the Vorion ACI Trust Engine API.
"""

from typing import Any, Optional

import httpx
from pydantic import BaseModel, Field

from .types import (
    AlertStatus,
    CeilingCheckRequest,
    CeilingCheckResponse,
    DashboardStats,
    GamingAlert,
    ProvenanceCreateRequest,
    ProvenanceRecord,
    RoleGateRequest,
    RoleGateResponse,
)


class ACIClientConfig(BaseModel):
    """Client configuration"""

    base_url: str = Field(description="Base URL of the ACI API")
    api_key: Optional[str] = Field(default=None, description="API key for authentication")
    timeout: float = Field(default=30.0, description="Request timeout in seconds")
    retry_count: int = Field(default=3, description="Number of retries for failed requests")
    retry_delay: float = Field(default=1.0, description="Delay between retries in seconds")


class ACIError(Exception):
    """ACI API error"""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        code: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details or {}


class ACIClient:
    """
    Async client for the Vorion ACI Trust Engine API.

    Example:
        >>> async with ACIClient("https://api.vorion.dev", api_key="...") as client:
        ...     stats = await client.get_stats()
        ...     print(stats.context_stats.agents)
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        **kwargs: Any,
    ):
        """
        Initialize ACI client.

        Args:
            base_url: Base URL of the ACI API
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
            **kwargs: Additional configuration options
        """
        self.config = ACIClientConfig(
            base_url=base_url.rstrip("/"),
            api_key=api_key,
            timeout=timeout,
            **kwargs,
        )
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "ACIClient":
        """Async context manager entry"""
        await self._ensure_client()
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit"""
        await self.close()

    async def _ensure_client(self) -> httpx.AsyncClient:
        """Ensure HTTP client is initialized"""
        if self._client is None:
            headers = {"Content-Type": "application/json"}
            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"

            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                headers=headers,
                timeout=self.config.timeout,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Make an HTTP request"""
        client = await self._ensure_client()

        response = await client.request(
            method=method,
            url=path,
            json=json,
            params=params,
        )

        if response.status_code >= 400:
            try:
                error_data = response.json()
                raise ACIError(
                    message=error_data.get("error", {}).get("message", "Unknown error"),
                    status_code=response.status_code,
                    code=error_data.get("error", {}).get("code"),
                    details=error_data.get("error", {}).get("details"),
                )
            except ValueError:
                raise ACIError(
                    message=f"HTTP {response.status_code}: {response.text}",
                    status_code=response.status_code,
                )

        return response.json()

    # =========================================================================
    # STATS
    # =========================================================================

    async def get_stats(self) -> DashboardStats:
        """
        Get dashboard statistics.

        Returns:
            DashboardStats: Aggregated statistics for the trust engine
        """
        data = await self._request("GET", "/api/phase6/stats")
        return DashboardStats.model_validate(data)

    # =========================================================================
    # ROLE GATES
    # =========================================================================

    async def evaluate_role_gate(self, request: RoleGateRequest) -> RoleGateResponse:
        """
        Evaluate a role gate request.

        Args:
            request: Role gate evaluation request

        Returns:
            RoleGateResponse: Evaluation result
        """
        data = await self._request(
            "POST",
            "/api/phase6/role-gates",
            json=request.model_dump(by_alias=True),
        )
        return RoleGateResponse.model_validate(data)

    # =========================================================================
    # CEILING
    # =========================================================================

    async def check_ceiling(self, request: CeilingCheckRequest) -> CeilingCheckResponse:
        """
        Check trust ceiling for an agent.

        Args:
            request: Ceiling check request

        Returns:
            CeilingCheckResponse: Ceiling check result
        """
        data = await self._request(
            "POST",
            "/api/phase6/ceiling",
            json=request.model_dump(by_alias=True),
        )
        return CeilingCheckResponse.model_validate(data)

    # =========================================================================
    # PROVENANCE
    # =========================================================================

    async def create_provenance(
        self, request: ProvenanceCreateRequest
    ) -> dict[str, ProvenanceRecord]:
        """
        Create a provenance record for an agent.

        Args:
            request: Provenance creation request

        Returns:
            Dict containing the created provenance record
        """
        data = await self._request(
            "POST",
            "/api/phase6/provenance",
            json=request.model_dump(by_alias=True),
        )
        return {"record": ProvenanceRecord.model_validate(data["record"])}

    async def get_provenance(self, agent_id: str) -> list[ProvenanceRecord]:
        """
        Get provenance records for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            List of provenance records
        """
        data = await self._request(
            "GET",
            "/api/phase6/provenance",
            params={"agentId": agent_id},
        )
        return [ProvenanceRecord.model_validate(r) for r in data.get("records", [])]

    # =========================================================================
    # ALERTS
    # =========================================================================

    async def get_alerts(
        self,
        status: Optional[AlertStatus] = None,
        agent_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[GamingAlert]:
        """
        Get gaming alerts.

        Args:
            status: Filter by alert status
            agent_id: Filter by agent ID
            limit: Maximum number of alerts to return

        Returns:
            List of gaming alerts
        """
        params: dict[str, Any] = {"limit": limit}
        if status:
            params["status"] = status.value
        if agent_id:
            params["agentId"] = agent_id

        data = await self._request("GET", "/api/phase6/alerts", params=params)
        return [GamingAlert.model_validate(a) for a in data.get("alerts", [])]

    async def update_alert_status(
        self,
        alert_id: str,
        status: AlertStatus,
        resolved_by: Optional[str] = None,
        resolution_notes: Optional[str] = None,
    ) -> GamingAlert:
        """
        Update alert status.

        Args:
            alert_id: Alert identifier
            status: New status
            resolved_by: Who resolved the alert
            resolution_notes: Resolution notes

        Returns:
            Updated alert
        """
        payload: dict[str, Any] = {"status": status.value}
        if resolved_by:
            payload["resolvedBy"] = resolved_by
        if resolution_notes:
            payload["resolutionNotes"] = resolution_notes

        data = await self._request(
            "PATCH",
            f"/api/phase6/alerts/{alert_id}",
            json=payload,
        )
        return GamingAlert.model_validate(data["alert"])
