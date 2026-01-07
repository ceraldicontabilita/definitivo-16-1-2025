# Warehouse Module - Magazzino e Prodotti
from .warehouse_main import router as warehouse_router
from .magazzino import router as magazzino_router
from .magazzino_products import router as magazzino_products_router
from .magazzino_doppia_verita import router as doppia_verita_router
from .products import router as products_router
from .products_catalog import router as products_catalog_router
from .lotti import router as lotti_router
from .ricette import router as ricette_router
from .tracciabilita import router as tracciabilita_router
from .dizionario_articoli import router as dizionario_router

__all__ = [
    'warehouse_router',
    'magazzino_router',
    'magazzino_products_router',
    'doppia_verita_router',
    'products_router',
    'products_catalog_router',
    'lotti_router',
    'ricette_router',
    'tracciabilita_router',
    'dizionario_router'
]
