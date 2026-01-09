"""
Azienda in Cloud ERP - Main Application Entry Point
FastAPI application with MongoDB Atlas - Refactored Modular Architecture
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.config import settings
from app.database import Database
from app.utils.logger import setup_logging, get_logger
from app.middleware.error_handler import add_exception_handlers

# Setup logging first
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Connect to database
    await Database.connect_db()
    
    # Start HACCP scheduler
    from app.scheduler import start_scheduler
    start_scheduler()
    
    logger.info("✅ Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("🔄 Shutting down application...")
    
    # Stop scheduler
    from app.scheduler import stop_scheduler
    stop_scheduler()
    
    await Database.close_db()
    logger.info("✅ Application shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=settings.ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Add exception handlers
add_exception_handlers(app)


# =============================================================================
# MODULAR ROUTER IMPORTS
# =============================================================================

# --- F24 Module ---
from app.routers.f24 import (
    f24_main, f24_riconciliazione, f24_tributi, f24_public, quietanze, email_f24,
    f24_gestione_avanzata
)

# --- HACCP Module ---
from app.routers.haccp import (
    haccp_main, haccp_completo, haccp_libro_unico, 
    haccp_technical_sheets, haccp_sanifications, haccp_report_pdf, haccp_auth
)

# --- Accounting Module ---
from app.routers.accounting import (
    accounting_main, accounting_extended, accounting_f24,
    prima_nota, prima_nota_automation, prima_nota_salari,
    piano_conti, bilancio, centri_costo, contabilita_avanzata,
    regole_categorizzazione, iva_calcolo, liquidazione_iva
)

# --- Bank Module ---
from app.routers.bank import (
    bank_main, bank_reconciliation, bank_statement_import,
    bank_statement_parser, estratto_conto, archivio_bonifici, assegni, pos_accredito
)
from app.routers.bank import riconciliazione_f24_banca

# --- Warehouse Module ---
from app.routers.warehouse import (
    warehouse_main, magazzino, magazzino_products, magazzino_doppia_verita,
    products, products_catalog, lotti, ricette, tracciabilita, dizionario_articoli
)

# --- Invoices Module ---
from app.routers.invoices import (
    invoices_main, invoices_emesse, invoices_export, fatture_upload, corrispettivi
)

# --- Employees Module ---
from app.routers.employees import (
    dipendenti, employees_payroll, employee_contracts, buste_paga, shifts, staff
)

# --- Reports Module ---
from app.routers.reports import (
    report_pdf, exports, simple_exports, analytics, dashboard
)

# --- Core Routers (non modulari) ---
from app.routers import (
    auth, suppliers, cash, chart_of_accounts, notifications,
    cash_register, failed_invoices, settings as settings_router,
    config, search, incasso_reale, ocr_assegni, cart, portal, orders,
    portal_extended, cash_register_extended, finanziaria, public_api,
    comparatore, gestione_riservata, commercialista, scadenze,
    riconciliazione_fornitori, ordini_fornitori, payroll, documents,
    pianificazione, admin, verifica_coerenza, documenti,
    operazioni_da_confermare, previsioni_acquisti,
    cedolini, tfr, cespiti, scadenzario_fornitori, calcolo_iva,
    controllo_gestione, indici_bilancio, chiusura_esercizio,
    gestione_iva_speciale
)

# --- HACCP New System ---
from app.routers.haccp_new import (
    temperature_positive, temperature_negative,
    chiusure, sanificazione
)


# =============================================================================
# ROUTER REGISTRATION
# =============================================================================

# --- Public API (no auth) ---
app.include_router(public_api.router, prefix="/api", tags=["Public API"])

# --- Authentication ---
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# --- F24 Module ---
app.include_router(f24_main.router, prefix="/api/f24", tags=["F24"])
app.include_router(f24_riconciliazione.router, prefix="/api/f24-riconciliazione", tags=["F24 Riconciliazione"])
app.include_router(f24_tributi.router, prefix="/api/f24", tags=["F24 Tributi"])
app.include_router(f24_public.router, prefix="/api/f24-public", tags=["F24 Public"])
app.include_router(quietanze.router, prefix="/api/quietanze-f24", tags=["Quietanze F24"])
app.include_router(email_f24.router, prefix="/api/email-f24", tags=["Email F24"])
app.include_router(f24_gestione_avanzata.router, prefix="/api/f24-avanzato", tags=["F24 Gestione Avanzata"])

# --- HACCP Module ---
app.include_router(haccp_main.router, prefix="/api/haccp", tags=["HACCP"])
app.include_router(haccp_completo.router, prefix="/api/haccp-completo", tags=["HACCP Completo"])
app.include_router(haccp_libro_unico.router, prefix="/api/haccp/libro-unico", tags=["HACCP Libro Unico"])
app.include_router(haccp_technical_sheets.router, prefix="/api/haccp/technical-sheets", tags=["HACCP Technical Sheets"])
app.include_router(haccp_sanifications.router, prefix="/api/haccp/sanifications", tags=["HACCP Sanifications"])
app.include_router(haccp_report_pdf.router, prefix="/api/haccp-report", tags=["HACCP Report PDF"])
app.include_router(haccp_auth.router, prefix="/api/haccp-auth", tags=["HACCP Auth"])

# --- Accounting Module ---
app.include_router(accounting_main.router, prefix="/api/accounting", tags=["Accounting"])
app.include_router(accounting_extended.router, prefix="/api/accounting", tags=["Accounting Extended"])
app.include_router(accounting_f24.router, prefix="/api/f24", tags=["F24 Accounting"])
app.include_router(prima_nota.router, prefix="/api/prima-nota", tags=["Prima Nota"])
app.include_router(prima_nota_automation.router, prefix="/api/prima-nota-auto", tags=["Prima Nota Automation"])
app.include_router(prima_nota_salari.router, prefix="/api/prima-nota-salari", tags=["Prima Nota Salari"])
app.include_router(piano_conti.router, prefix="/api/piano-conti", tags=["Piano dei Conti"])
app.include_router(bilancio.router, prefix="/api/bilancio", tags=["Bilancio"])
app.include_router(centri_costo.router, prefix="/api/centri-costo", tags=["Centri di Costo"])
app.include_router(contabilita_avanzata.router, prefix="/api/contabilita", tags=["Contabilita Avanzata"])
app.include_router(regole_categorizzazione.router, prefix="/api/regole", tags=["Regole Categorizzazione"])
app.include_router(iva_calcolo.router, prefix="/api/iva", tags=["IVA Calcolo"])
app.include_router(liquidazione_iva.router, prefix="/api", tags=["Liquidazione IVA"])

# --- Bank Module ---
app.include_router(bank_main.router, prefix="/api/bank", tags=["Bank"])
app.include_router(bank_reconciliation.router, prefix="/api/bank-reconciliation", tags=["Bank Reconciliation"])
app.include_router(bank_statement_import.router, prefix="/api/bank-statement", tags=["Bank Statement Import"])
app.include_router(bank_statement_parser.router, prefix="/api/estratto-conto", tags=["Estratto Conto Parser"])
app.include_router(estratto_conto.router, prefix="/api/estratto-conto-movimenti", tags=["Estratto Conto Movimenti"])
app.include_router(archivio_bonifici.router, prefix="/api", tags=["Archivio Bonifici"])
app.include_router(assegni.router, prefix="/api/assegni", tags=["Assegni"])
app.include_router(pos_accredito.router, prefix="/api/pos-accredito", tags=["POS Accredito"])
app.include_router(riconciliazione_f24_banca.router, prefix="/api/f24-riconciliazione", tags=["Riconciliazione F24 Banca"])

# --- Warehouse Module ---
app.include_router(warehouse_main.router, prefix="/api/warehouse", tags=["Warehouse"])
app.include_router(magazzino.router, prefix="/api/magazzino", tags=["Magazzino"])
app.include_router(magazzino_products.router, prefix="/api/magazzino", tags=["Magazzino Products"])
app.include_router(magazzino_doppia_verita.router, prefix="/api/magazzino-dv", tags=["Magazzino Doppia Verità"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(products_catalog.router, prefix="/api/products", tags=["Products Catalog"])
app.include_router(lotti.router, prefix="/api/lotti", tags=["Lotti"])
app.include_router(ricette.router, prefix="/api/ricette", tags=["Ricette e Produzione"])
app.include_router(tracciabilita.router, prefix="/api/tracciabilita", tags=["Tracciabilita"])
app.include_router(dizionario_articoli.router, prefix="/api/dizionario-articoli", tags=["Dizionario Articoli"])

# --- Invoices Module ---
app.include_router(invoices_emesse.router, prefix="/api/invoices/emesse", tags=["Invoices Emesse"])
app.include_router(invoices_main.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(invoices_export.router, prefix="/api/invoices", tags=["Invoices Export"])
app.include_router(fatture_upload.router, prefix="/api/fatture", tags=["Fatture Upload"])
app.include_router(corrispettivi.router, prefix="/api/corrispettivi", tags=["Corrispettivi"])

# --- Employees Module ---
app.include_router(dipendenti.router, prefix="/api/dipendenti", tags=["Dipendenti"])
app.include_router(employees_payroll.router, prefix="/api/employees", tags=["Employees Payroll"])
app.include_router(employee_contracts.router, prefix="/api/contracts", tags=["Employee Contracts"])
app.include_router(buste_paga.router, prefix="/api", tags=["Buste Paga"])
app.include_router(shifts.router, prefix="/api/shifts", tags=["Shifts"])
app.include_router(staff.router, prefix="/api/staff", tags=["Staff"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])

# --- Reports Module ---
app.include_router(report_pdf.router, prefix="/api/report-pdf", tags=["Report PDF"])
app.include_router(exports.router, prefix="/api/exports", tags=["Exports"])
app.include_router(simple_exports.router, prefix="/api/exports", tags=["Simple Exports"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

# --- Core Routers ---
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"])
app.include_router(cash.router, prefix="/api/cash", tags=["Cash Register"])
app.include_router(chart_of_accounts.router, prefix="/api/chart-of-accounts", tags=["Chart of Accounts"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(cash_register.router, prefix="/api/cash-register", tags=["Cash Register Operations"])
app.include_router(cash_register_extended.router, prefix="/api/cash-register", tags=["Cash Register Extended"])
app.include_router(failed_invoices.router, prefix="/api/failed-invoices", tags=["Failed Invoices"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(incasso_reale.router, prefix="/api/incasso-reale", tags=["Incasso Reale"])
app.include_router(ocr_assegni.router, prefix="/api/ocr-assegni", tags=["OCR Assegni"])
app.include_router(cart.router, prefix="/api/cart", tags=["Cart"])
app.include_router(portal.router, prefix="/api/portal", tags=["Portal"])
app.include_router(portal_extended.router, prefix="/api/portal", tags=["Portal Extended"])
app.include_router(orders.router, prefix="/api", tags=["Orders"])
app.include_router(finanziaria.router, prefix="/api/finanziaria", tags=["Finanziaria"])
app.include_router(comparatore.router, prefix="/api/comparatore", tags=["Comparatore Prezzi"])
app.include_router(gestione_riservata.router, prefix="/api/gestione-riservata", tags=["Gestione Riservata"])
app.include_router(commercialista.router, prefix="/api/commercialista", tags=["Commercialista"])
app.include_router(scadenze.router, prefix="/api/scadenze", tags=["Scadenze e Notifiche"])
app.include_router(riconciliazione_fornitori.router, prefix="/api/riconciliazione-fornitori", tags=["Riconciliazione Fornitori"])
app.include_router(ordini_fornitori.router, prefix="/api/ordini-fornitori", tags=["Ordini Fornitori"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(pianificazione.router, prefix="/api/pianificazione", tags=["Pianificazione"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(verifica_coerenza.router, prefix="/api/verifica-coerenza", tags=["Verifica Coerenza Dati"])
app.include_router(documenti.router, prefix="/api/documenti", tags=["Gestione Documenti Email"])
app.include_router(operazioni_da_confermare.router, prefix="/api/operazioni-da-confermare", tags=["Operazioni da Confermare"])
app.include_router(previsioni_acquisti.router, prefix="/api/previsioni-acquisti", tags=["Previsioni Acquisti"])
app.include_router(cedolini.router, prefix="/api/cedolini", tags=["Cedolini Paga"])
app.include_router(tfr.router, prefix="/api/tfr", tags=["TFR"])
app.include_router(cespiti.router, prefix="/api/cespiti", tags=["Cespiti e Ammortamenti"])
app.include_router(scadenzario_fornitori.router, prefix="/api/scadenzario-fornitori", tags=["Scadenzario Fornitori"])
app.include_router(calcolo_iva.router, prefix="/api/calcolo-iva", tags=["Calcolo IVA"])
app.include_router(controllo_gestione.router, prefix="/api/controllo-gestione", tags=["Controllo Gestione"])
app.include_router(indici_bilancio.router, prefix="/api/indici-bilancio", tags=["Indici di Bilancio"])
app.include_router(chiusura_esercizio.router, prefix="/api/chiusura-esercizio", tags=["Chiusura Esercizio"])
app.include_router(gestione_iva_speciale.router, prefix="/api/iva-speciale", tags=["IVA Speciale"])


# =============================================================================
# HEALTH CHECK ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "environment": settings.ENVIRONMENT
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Detailed health check endpoint."""
    db_status = "connected" if Database.db is not None else "disconnected"
    
    return {
        "status": "healthy",
        "database": db_status,
        "version": settings.APP_VERSION
    }


# Mount static files for downloads
docs_path = "/app/docs"
if os.path.exists(docs_path):
    app.mount("/api/download", StaticFiles(directory=docs_path), name="download")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
