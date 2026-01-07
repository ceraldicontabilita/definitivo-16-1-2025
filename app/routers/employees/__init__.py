# Employees Module - Gestione Dipendenti
from .dipendenti import router as dipendenti_router
from .employees_payroll import router as payroll_router
from .employee_contracts import router as contracts_router
from .buste_paga import router as buste_paga_router
from .shifts import router as shifts_router
from .staff import router as staff_router

__all__ = [
    'dipendenti_router',
    'payroll_router',
    'contracts_router',
    'buste_paga_router',
    'shifts_router',
    'staff_router'
]
