# Reports Module - Report e Esportazioni
from .report_pdf import router as report_pdf_router
from .exports import router as exports_router
from .simple_exports import router as simple_exports_router
from .analytics import router as analytics_router
from .dashboard import router as dashboard_router

__all__ = [
    'report_pdf_router',
    'exports_router',
    'simple_exports_router',
    'analytics_router',
    'dashboard_router'
]
