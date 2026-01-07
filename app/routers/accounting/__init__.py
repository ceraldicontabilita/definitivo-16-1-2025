# Accounting Module - Contabilità e Prima Nota
from .accounting_main import router as accounting_router
from .accounting_extended import router as extended_router
from .accounting_f24 import router as f24_router
from .prima_nota import router as prima_nota_router
from .prima_nota_automation import router as prima_nota_auto_router
from .prima_nota_salari import router as prima_nota_salari_router
from .piano_conti import router as piano_conti_router
from .bilancio import router as bilancio_router
from .centri_costo import router as centri_costo_router
from .contabilita_avanzata import router as avanzata_router
from .regole_categorizzazione import router as regole_router
from .iva_calcolo import router as iva_router
from .liquidazione_iva import router as liquidazione_iva_router

__all__ = [
    'accounting_router',
    'extended_router',
    'f24_router',
    'prima_nota_router',
    'prima_nota_auto_router',
    'prima_nota_salari_router',
    'piano_conti_router',
    'bilancio_router',
    'centri_costo_router',
    'avanzata_router',
    'regole_router',
    'iva_router',
    'liquidazione_iva_router'
]
