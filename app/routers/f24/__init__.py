# F24 Module - Gestione F24 e Riconciliazione
from .f24_main import router as f24_router
from .f24_riconciliazione import router as riconciliazione_router
from .f24_tributi import router as tributi_router
from .f24_public import router as public_router
from .quietanze import router as quietanze_router
from .email_f24 import router as email_router

__all__ = [
    'f24_router',
    'riconciliazione_router', 
    'tributi_router',
    'public_router',
    'quietanze_router',
    'email_router'
]
