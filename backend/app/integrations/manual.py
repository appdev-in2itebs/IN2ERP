"""
In2IT ERP - Manual "connector"

For applications without an automated integration. It never reports success: every
change requires an application owner to apply it in the target application and then
confirm it in the ERP, which is recorded in the audit trail.
"""

from app.integrations.base import Connector, ExternalRole, ManualActionRequired, Subject


class ManualConnector(Connector):
    name = "manual"

    async def test_connection(self) -> None:
        raise ManualActionRequired("This application is managed manually")

    async def list_roles(self) -> list[ExternalRole]:
        raise ManualActionRequired("Roles for this application are maintained manually")

    async def get_user_roles(self, subject: Subject) -> set[str]:
        raise ManualActionRequired("Access for this application is confirmed manually")

    async def grant(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        raise ManualActionRequired("Grant the role in the application, then confirm it in In2ERP")

    async def revoke(self, subject: Subject, external_role_id: str, idempotency_key: str) -> None:
        raise ManualActionRequired("Remove the role in the application, then confirm it in In2ERP")
