# HACCP Module - Gestione HACCP Completa
from .haccp_main import router as haccp_router
from .haccp_completo import router as completo_router
from .haccp_libro_unico import router as libro_unico_router
from .haccp_technical_sheets import router as technical_sheets_router
from .haccp_sanifications import router as sanifications_router
from .haccp_report_pdf import router as report_pdf_router
from .haccp_auth import router as auth_router

__all__ = [
    'haccp_router',
    'completo_router',
    'libro_unico_router',
    'technical_sheets_router',
    'sanifications_router',
    'report_pdf_router',
    'auth_router'
]
