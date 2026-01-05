"""
Routers package.
API endpoints for all modules.
"""
from . import (
    auth, invoices, suppliers, warehouse, accounting, haccp,
    cash, bank,
    chart_of_accounts, exports, finanziaria
)

__all__ = [
    "auth",
    "invoices",
    "suppliers",
    "warehouse",
    "accounting",
    "haccp",
    "cash",
    "bank",
    "chart_of_accounts",
    "exports",
    "finanziaria"
]
