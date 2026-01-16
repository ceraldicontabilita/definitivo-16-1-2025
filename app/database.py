"""
Database configuration and connection management.
Provides singleton Motor AsyncIOMotorClient for MongoDB Atlas.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging
from .config import settings

logger = logging.getLogger(__name__)


class Database:
    """MongoDB connection manager with singleton pattern."""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect_db(cls) -> None:
        """
        Create database connection.
        Called on application startup.
        """
        try:
            logger.info("Connecting to MongoDB Atlas...")
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_ATLAS_URI,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS
            )
            cls.db = cls.client[settings.DB_NAME]
            
            # Test connection
            await cls.client.admin.command('ping')
            logger.info(f"✅ Connected to MongoDB database: {settings.DB_NAME}")
            
            # Create indexes for unique constraints
            await cls._create_indexes()
            
        except Exception as e:
            logger.error(f"❌ Error connecting to MongoDB: {e}")
            raise

    @classmethod
    async def _create_indexes(cls) -> None:
        """Create database indexes for unique constraints and performance."""
        try:
            # Unique index for invoices (numero + p.iva + data)
            await cls.db[Collections.INVOICES].create_index(
                "invoice_key",
                unique=True,
                sparse=True,
                name="idx_invoice_key_unique"
            )
            logger.info("✅ Database indexes created")
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")

    @classmethod
    async def close_db(cls) -> None:
        """
        Close database connection.
        Called on application shutdown.
        """
        if cls.client:
            logger.info("Closing MongoDB connection...")
            cls.client.close()
            logger.info("✅ MongoDB connection closed")

    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """
        Get database instance.
        
        Returns:
            AsyncIOMotorDatabase: MongoDB database instance
            
        Raises:
            RuntimeError: If database is not connected
        """
        if cls.db is None:
            raise RuntimeError("Database not initialized. Call connect_db() first.")
        return cls.db

    @classmethod
    def get_collection(cls, collection_name: str):
        """
        Get a collection from the database.
        
        Args:
            collection_name: Name of the collection
            
        Returns:
            AsyncIOMotorCollection: MongoDB collection instance
        """
        db = cls.get_db()
        return db[collection_name]


# Convenience function for dependency injection
async def get_database() -> AsyncIOMotorDatabase:
    """
    FastAPI dependency to get database instance.
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(db: AsyncIOMotorDatabase = Depends(get_database)):
            ...
    """
    return Database.get_db()


# Collection name constants
class Collections:
    """MongoDB collection names - STANDARDIZED."""
    # Core
    USERS = "users"
    
    # Invoices
    INVOICES = "invoices"
    INVOICE_METADATA_TEMPLATES = "invoice_metadata_templates"
    
    # Suppliers - usa "fornitori" che è la collezione con i dati
    SUPPLIERS = "fornitori"
    
    # Warehouse
    WAREHOUSE_PRODUCTS = "warehouse_inventory"
    WAREHOUSE_MOVEMENTS = "warehouse_movements"
    RIMANENZE = "rimanenze"
    
    # Corrispettivi
    CORRISPETTIVI = "corrispettivi"
    
    # Employees
    EMPLOYEES = "employees"
    PAYSLIPS = "payslips"
    
    # HACCP
    HACCP_TEMPERATURES = "haccp_temperatures"
    LIBRETTI_SANITARI = "libretti_sanitari"
    
    # Cash & Bank - USE prima_nota_cassa/prima_nota_banca as canonical names
    CASH_MOVEMENTS = "prima_nota_cassa"  # Changed from cash_movements
    BANK_STATEMENTS = "bank_statements"
    
    # Accounting
    CHART_OF_ACCOUNTS = "chart_of_accounts"
    ACCOUNTING_ENTRIES = "accounting_entries"
    VAT_LIQUIDATIONS = "vat_liquidations"
    VAT_REGISTRY = "vat_registry"
    F24_MODELS = "f24_models"
    BALANCE_SHEETS = "balance_sheets"
    YEAR_END_CLOSURES = "year_end_closures"
    
    # Settings
    WAREHOUSE_SETTINGS = "warehouse_settings"
    SYSTEM_SETTINGS = "system_settings"
