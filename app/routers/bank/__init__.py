# Bank Module - Gestione Banca e Riconciliazione
from .bank_main import router as bank_router
from .bank_reconciliation import router as reconciliation_router
from .bank_statement_import import router as statement_import_router
from .bank_statement_parser import router as statement_parser_router
from .estratto_conto import router as estratto_conto_router
from .archivio_bonifici import router as bonifici_router
from .assegni import router as assegni_router
from .pos_accredito import router as pos_router

__all__ = [
    'bank_router',
    'reconciliation_router',
    'statement_import_router',
    'statement_parser_router',
    'estratto_conto_router',
    'bonifici_router',
    'assegni_router',
    'pos_router'
]
