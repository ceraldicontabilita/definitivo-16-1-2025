"""
Azienda in Cloud ERP - Main Application Entry Point
FastAPI application with MongoDB Atlas app.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

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

# Import and include routers
from app.routers import (
    auth, invoices, suppliers, warehouse, accounting, haccp,
    cash, bank,
    chart_of_accounts, exports,
    dashboard, notifications, cash_register, failed_invoices, staff, settings as settings_router,
    config, search, incasso_reale, lotti, assegni,
    tracciabilita, bank_reconciliation, payroll, products, documents,
    pianificazione, admin, analytics, shifts, ocr_assegni, magazzino, invoices_emesse,
    cart, portal, orders,
    f24, haccp_libro_unico, haccp_technical_sheets, haccp_sanifications,
    accounting_extended,
    portal_extended,
    cash_register_extended, magazzino_products,
    invoices_export, finanziaria,
    public_api,
    comparatore,
    prima_nota,
    prima_nota_automation,
    dipendenti,
    haccp_completo,
    fatture_upload,
    corrispettivi_router,
    iva_calcolo,
    ordini_fornitori,
    products_catalog,
    employees_payroll,
    f24_tributi,
    accounting_f24,
    f24_public,
    haccp_report_pdf,
    simple_exports,
    email_notifications,
    employee_contracts,
    bank_statement_import,
    piano_conti,
    commercialista,
    bilancio,
    pos_accredito,
    scadenze,
    bank_statement_parser,
    riconciliazione_fornitori,
    estratto_conto
)

# Include public API first (no auth required)
app.include_router(public_api.router, prefix="/api", tags=["Public API"])
app.include_router(email_notifications.router, prefix="/api/email", tags=["Email Notifications"])
app.include_router(employee_contracts.router, prefix="/api/contracts", tags=["Employee Contracts"])

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(invoices_emesse.router, prefix="/api/invoices/emesse", tags=["Invoices Emesse"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"])
app.include_router(warehouse.router, prefix="/api/warehouse", tags=["Warehouse"])
app.include_router(accounting.router, prefix="/api/accounting", tags=["Accounting"])
app.include_router(haccp.router, prefix="/api/haccp", tags=["HACCP"])
app.include_router(cash.router, prefix="/api/cash", tags=["Cash Register"])
app.include_router(bank.router, prefix="/api/bank", tags=["Bank"])
# app.include_router(invoices_advanced.router, prefix="/api/invoices", tags=["Invoices Advanced"])
# app.include_router(warehouse_advanced.router, prefix="/api/warehouse", tags=["Warehouse Advanced"])
app.include_router(chart_of_accounts.router, prefix="/api/chart-of-accounts", tags=["Chart of Accounts"])
app.include_router(exports.router, prefix="/api/exports", tags=["Exports"])
# Additional routers
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(cash_register.router, prefix="/api/cash-register", tags=["Cash Register Operations"])
app.include_router(failed_invoices.router, prefix="/api/failed-invoices", tags=["Failed Invoices"])
app.include_router(staff.router, prefix="/api/staff", tags=["Staff"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(incasso_reale.router, prefix="/api/incasso-reale", tags=["Incasso Reale"])
app.include_router(lotti.router, prefix="/api/lotti", tags=["Lotti"])
app.include_router(assegni.router, prefix="/api/assegni", tags=["Assegni"])
app.include_router(tracciabilita.router, prefix="/api/tracciabilita", tags=["Tracciabilita"])
app.include_router(bank_reconciliation.router, prefix="/api/bank-reconciliation", tags=["Bank Reconciliation"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(pianificazione.router, prefix="/api/pianificazione", tags=["Pianificazione"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(shifts.router, prefix="/api/shifts", tags=["Shifts"])
app.include_router(ocr_assegni.router, prefix="/api/ocr-assegni", tags=["OCR Assegni"])
app.include_router(magazzino.router, prefix="/api/magazzino", tags=["Magazzino"])
app.include_router(cart.router, prefix="/api/cart", tags=["Cart"])
app.include_router(portal.router, prefix="/api/portal", tags=["Portal"])
app.include_router(orders.router, prefix="/api", tags=["Orders"])
app.include_router(f24.router, prefix="/api/f24", tags=["F24"])
app.include_router(haccp_libro_unico.router, prefix="/api/haccp/libro-unico", tags=["HACCP Libro Unico"])
app.include_router(haccp_technical_sheets.router, prefix="/api/haccp/technical-sheets", tags=["HACCP Technical Sheets"])
app.include_router(haccp_sanifications.router, prefix="/api/haccp/sanifications", tags=["HACCP Sanifications"])
# Extended routers
app.include_router(accounting_extended.router, prefix="/api/accounting", tags=["Accounting Extended"])
app.include_router(portal_extended.router, prefix="/api/portal", tags=["Portal Extended"])
app.include_router(cash_register_extended.router, prefix="/api/cash-register", tags=["Cash Register Extended"])
app.include_router(magazzino_products.router, prefix="/api/magazzino", tags=["Magazzino Products"])
app.include_router(finanziaria.router, prefix="/api/finanziaria", tags=["Finanziaria"])
app.include_router(comparatore.router, prefix="/api/comparatore", tags=["Comparatore Prezzi"])
app.include_router(prima_nota.router, prefix="/api/prima-nota", tags=["Prima Nota"])
app.include_router(prima_nota_automation.router, prefix="/api/prima-nota-auto", tags=["Prima Nota Automation"])
app.include_router(dipendenti.router, prefix="/api/dipendenti", tags=["Dipendenti"])
app.include_router(haccp_completo.router, prefix="/api/haccp-completo", tags=["HACCP Completo"])

# app.include_router(fattura24.router, prefix="/api/fattura24", tags=["Fattura24"])
app.include_router(exports.router, prefix="/api/export", tags=["Exports Alias"])
app.include_router(simple_exports.router, prefix="/api/exports", tags=["Simple Exports"])

# New refactored routers
app.include_router(fatture_upload.router, prefix="/api/fatture", tags=["Fatture Upload"])
app.include_router(corrispettivi_router.router, prefix="/api/corrispettivi", tags=["Corrispettivi"])
app.include_router(iva_calcolo.router, prefix="/api/iva", tags=["IVA Calcolo"])
app.include_router(ordini_fornitori.router, prefix="/api/ordini-fornitori", tags=["Ordini Fornitori"])
app.include_router(products_catalog.router, prefix="/api/products", tags=["Products Catalog"])
app.include_router(employees_payroll.router, prefix="/api/employees", tags=["Employees Payroll"])
app.include_router(f24_tributi.router, prefix="/api/f24", tags=["F24 Tributi"])
app.include_router(accounting_f24.router, prefix="/api/f24", tags=["F24 Accounting"])
app.include_router(f24_public.router, prefix="/api/f24-public", tags=["F24 Public"])
app.include_router(haccp_report_pdf.router, prefix="/api/haccp-report", tags=["HACCP Report PDF"])
app.include_router(bank_statement_import.router, prefix="/api/bank-statement", tags=["Bank Statement Import"])
app.include_router(piano_conti.router, prefix="/api/piano-conti", tags=["Piano dei Conti"])
app.include_router(commercialista.router, prefix="/api/commercialista", tags=["Commercialista"])
app.include_router(bilancio.router, prefix="/api/bilancio", tags=["Bilancio"])
app.include_router(pos_accredito.router, prefix="/api/pos-accredito", tags=["POS Accredito"])
app.include_router(scadenze.router, prefix="/api/scadenze", tags=["Scadenze e Notifiche"])
app.include_router(bank_statement_parser.router, prefix="/api/estratto-conto", tags=["Estratto Conto Parser"])
app.include_router(riconciliazione_fornitori.router, prefix="/api/riconciliazione-fornitori", tags=["Riconciliazione Fornitori"])

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


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
