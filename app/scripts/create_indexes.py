"""
Script per creare indici MongoDB ottimizzati.

Esegui con: python -m app.scripts.create_indexes
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "azienda_erp_db")

if not MONGO_URL:
    raise ValueError("MONGO_URL environment variable is required - use MongoDB Atlas connection string")


async def create_indexes():
    """Crea tutti gli indici ottimizzati per le collezioni principali."""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    logger.info("🚀 Creazione indici MongoDB...")
    
    indexes_created = []
    
    try:
        # ============================================
        # FATTURE RICEVUTE
        # ============================================
        await db["fatture_ricevute"].create_index("data_ricezione")
        await db["fatture_ricevute"].create_index("data_fattura")
        await db["fatture_ricevute"].create_index("fornitore")
        await db["fatture_ricevute"].create_index("numero_fattura")
        await db["fatture_ricevute"].create_index([("data_ricezione", -1), ("fornitore", 1)])
        indexes_created.append("fatture_ricevute: data_ricezione, data_fattura, fornitore, numero_fattura")
        logger.info("✅ Indici fatture_ricevute creati")
        
        # ============================================
        # FATTURE EMESSE
        # ============================================
        await db["fatture_emesse"].create_index("data_fattura")
        await db["fatture_emesse"].create_index("cliente")
        await db["fatture_emesse"].create_index("numero")
        await db["fatture_emesse"].create_index("stato")
        await db["fatture_emesse"].create_index([("data_fattura", -1)])
        indexes_created.append("fatture_emesse: data_fattura, cliente, numero, stato")
        logger.info("✅ Indici fatture_emesse creati")
        
        # ============================================
        # PRIMA NOTA
        # ============================================
        await db["prima_nota"].create_index("data")
        await db["prima_nota"].create_index("tipo")
        await db["prima_nota"].create_index("categoria")
        await db["prima_nota"].create_index([("data", -1), ("tipo", 1)])
        await db["prima_nota"].create_index([("data", 1), ("categoria", 1)])
        indexes_created.append("prima_nota: data, tipo, categoria, compound indexes")
        logger.info("✅ Indici prima_nota creati")
        
        # ============================================
        # ESTRATTO CONTO MOVIMENTI
        # ============================================
        await db["estratto_conto_movimenti"].create_index("data_operazione")
        await db["estratto_conto_movimenti"].create_index("data_valuta")
        await db["estratto_conto_movimenti"].create_index("stato")
        await db["estratto_conto_movimenti"].create_index("riconciliato")
        await db["estratto_conto_movimenti"].create_index([("data_operazione", -1), ("stato", 1)])
        indexes_created.append("estratto_conto_movimenti: data_operazione, data_valuta, stato, riconciliato")
        logger.info("✅ Indici estratto_conto_movimenti creati")
        
        # ============================================
        # DIPENDENTI
        # ============================================
        await db["employees"].create_index("codice_fiscale", unique=True, sparse=True)
        await db["employees"].create_index("status")
        await db["employees"].create_index("nome_completo")
        await db["employees"].create_index([("cognome", 1), ("nome", 1)])
        indexes_created.append("employees: codice_fiscale (unique), status, nome_completo")
        logger.info("✅ Indici employees creati")
        
        # ============================================
        # CEDOLINI
        # ============================================
        await db["cedolini"].create_index("dipendente_id")
        await db["cedolini"].create_index([("anno", -1), ("mese", -1)])
        await db["cedolini"].create_index([("dipendente_id", 1), ("anno", 1), ("mese", 1)])
        indexes_created.append("cedolini: dipendente_id, anno/mese compound")
        logger.info("✅ Indici cedolini creati")
        
        # ============================================
        # F24
        # ============================================
        await db["f24_models"].create_index("data_scadenza")
        await db["f24_models"].create_index("pagato")
        await db["f24_models"].create_index([("data_scadenza", 1), ("pagato", 1)])
        indexes_created.append("f24_models: data_scadenza, pagato")
        logger.info("✅ Indici f24_models creati")
        
        # ============================================
        # SCADENZARIO
        # ============================================
        await db["scadenzario"].create_index("data_scadenza")
        await db["scadenzario"].create_index("pagato")
        await db["scadenzario"].create_index("tipo")
        await db["scadenzario"].create_index([("data_scadenza", 1), ("pagato", 1)])
        indexes_created.append("scadenzario: data_scadenza, pagato, tipo")
        logger.info("✅ Indici scadenzario creati")
        
        # ============================================
        # CORRISPETTIVI
        # ============================================
        await db["corrispettivi"].create_index("data")
        await db["corrispettivi"].create_index([("data", -1)])
        indexes_created.append("corrispettivi: data")
        logger.info("✅ Indici corrispettivi creati")
        
        # ============================================
        # FORNITORI
        # ============================================
        await db["fornitori"].create_index("partita_iva", unique=True, sparse=True)
        await db["fornitori"].create_index("ragione_sociale")
        await db["fornitori"].create_index([("ragione_sociale", "text")])
        indexes_created.append("fornitori: partita_iva (unique), ragione_sociale, text search")
        logger.info("✅ Indici fornitori creati")
        
        # ============================================
        # API CLIENTS
        # ============================================
        await db["api_clients"].create_index("key_hash", unique=True)
        await db["api_clients"].create_index("active")
        indexes_created.append("api_clients: key_hash (unique), active")
        logger.info("✅ Indici api_clients creati")
        
        # ============================================
        # DOCUMENTS INBOX
        # ============================================
        await db["documents_inbox"].create_index("category")
        await db["documents_inbox"].create_index("status")
        await db["documents_inbox"].create_index("downloaded_at")
        await db["documents_inbox"].create_index([("category", 1), ("status", 1)])
        indexes_created.append("documents_inbox: category, status, downloaded_at")
        logger.info("✅ Indici documents_inbox creati")
        
        logger.info(f"\n{'='*50}")
        logger.info(f"✅ COMPLETATO: {len(indexes_created)} gruppi di indici creati")
        logger.info(f"{'='*50}")
        
        for idx in indexes_created:
            logger.info(f"  • {idx}")
        
    except Exception as e:
        logger.error(f"❌ Errore creazione indici: {e}")
        raise
    finally:
        client.close()
    
    return indexes_created


async def show_indexes():
    """Mostra tutti gli indici esistenti."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    collections = await db.list_collection_names()
    
    logger.info("\n📊 INDICI ESISTENTI:")
    logger.info("="*50)
    
    for coll_name in sorted(collections):
        indexes = await db[coll_name].index_information()
        if len(indexes) > 1:  # Più di solo _id
            logger.info(f"\n{coll_name}:")
            for idx_name, idx_info in indexes.items():
                if idx_name != "_id_":
                    keys = idx_info.get("key", [])
                    logger.info(f"  • {idx_name}: {keys}")
    
    client.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--show":
        asyncio.run(show_indexes())
    else:
        asyncio.run(create_indexes())
