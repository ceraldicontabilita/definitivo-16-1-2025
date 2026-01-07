"""
Comparatore Prezzi - Confronto prezzi prodotti tra fornitori diversi.

Questo modulo permette di:
- Confrontare prezzi dello stesso prodotto da fornitori diversi
- Normalizzare nomi prodotti con AI per matching
- Gestire un carrello per ordini multi-fornitore
- Escludere fornitori dal confronto
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import re
import os
import logging

from app.database import Database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/comparatore", tags=["Comparatore Prezzi"])


# ==================== HELPERS ====================

def clean_normalized_name(name: str) -> str:
    """Pulisce nome prodotto normalizzato rimuovendo info pack size."""
    try:
        if not name:
            return name
        name = re.sub(r"\s+", " ", name).strip()
        # Rimuovi pattern pack-size (es. '96PZ', '96 PZ', '96 PEZZI')
        pattern = r"(\s*[-,/]*\s*\d+\s*(pz|pz\.|PZ|PZ\.|pezzi|PEZZI)\s*)$"
        name = re.sub(pattern, "", name).strip()
        return name
    except Exception:
        return name


async def normalize_product_name_ai(description: str) -> str:
    """Normalizza nome prodotto usando AI."""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            logger.warning("EMERGENT_LLM_KEY not found, using fallback")
            words = description.split()
            if words:
                return words[0].strip('.,!?"\'').capitalize()
            return description
        
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"normalize_{uuid.uuid4()}",
            system_message="Tu sei un normalizzatore di nomi prodotti alimentari e bevande. Estrai il nome essenziale del prodotto MANTENENDO varianti/gusti importanti. Rispondi SOLO con 2-3 parole massimo. Esempi: 'COCA COLA VETRO 33CL 24PZ' -> Coca Cola | 'PASSATA ALBICOCCA 720ML 12PZ' -> Passata Albicocca | 'OLIO EXTRAVERGINE OLIVA 1L' -> Olio Extravergine | 'ACQUA NATURALE 1.5L 6PZ' -> Acqua Naturale | 'BIRRA MORETTI 33CL' -> Birra Moretti"
        ).with_model("gemini", "gemini-2.5-flash")
        
        user_message = UserMessage(text=description)
        response = await chat.send_message(user_message)
        normalized = response.strip().strip('"\'.,!? ')
        
        if len(normalized) > 30:
            words = normalized.split()
            if len(words) > 3:
                normalized = ' '.join(words[:3])
        
        normalized = clean_normalized_name(normalized)
        logger.info(f"Normalized '{description}' to '{normalized}'")
        return normalized
    except Exception as e:
        logger.error(f"Error normalizing: {str(e)}")
        return description


# ==================== API ROUTES ====================

@router.get("/")
async def comparatore_root():
    """Root endpoint del comparatore prezzi."""
    return {"message": "Comparatore Prezzi API", "version": "1.0"}


@router.get("/suppliers")
async def get_suppliers():
    """Ottieni lista di tutti i fornitori dalle fatture."""
    try:
        db = Database.get_db()
        suppliers = await db.invoices.distinct("supplier_name")
        return {"suppliers": [s for s in suppliers if s]}
    except Exception as e:
        logger.error(f"Error fetching suppliers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unmapped-products")
async def get_unmapped_products(limit: int = Query(100, le=500)):
    """Ottieni prodotti non ancora mappati (senza nome normalizzato)."""
    try:
        db = Database.get_db()
        invoices = await db.invoices.find().limit(200).to_list(length=None)
        
        unmapped = []
        seen_descriptions = set()
        
        for invoice in invoices:
            for product in invoice.get("products", []) or invoice.get("linee", []):
                desc = product.get("descrizione") or product.get("description", "")
                
                if not desc or desc in seen_descriptions:
                    continue
                
                # Controlla se già mappato
                catalog_entry = await db.product_catalog.find_one({"original_description": desc})
                
                if not catalog_entry or not catalog_entry.get("product_name"):
                    unmapped.append({
                        "id": str(uuid.uuid4()),
                        "original_description": desc,
                        "supplier_name": invoice.get("supplier_name", ""),
                        "invoice_number": invoice.get("invoice_number", "")
                    })
                    seen_descriptions.add(desc)
        
        return {"unmapped_products": unmapped[:limit]}
    except Exception as e:
        logger.error(f"Error fetching unmapped products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mapped-products")
async def get_mapped_products():
    """Ottieni prodotti già mappati dal catalogo."""
    try:
        db = Database.get_db()
        catalog_items = await db.product_catalog.find({
            "product_name": {"$ne": None, "$ne": ""}
        }).limit(500).to_list(length=None)
        
        mapped = []
        for item in catalog_items:
            mapped.append({
                "id": item.get("id", str(uuid.uuid4())),
                "original_description": item.get("original_description", ""),
                "normalized_name": item.get("product_name", ""),
                "supplier_name": item.get("supplier_name", "")
            })
        
        return {"mapped_products": mapped}
    except Exception as e:
        logger.error(f"Error fetching mapped products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/map-product")
async def map_product(original_description: str, custom_name: Optional[str] = None):
    """
    Mappa un singolo prodotto usando AI o nome custom.
    
    Args:
        original_description: Descrizione originale del prodotto
        custom_name: Nome normalizzato manuale (opzionale)
    """
    try:
        db = Database.get_db()
        
        if custom_name:
            normalized_name = custom_name
        else:
            normalized_name = await normalize_product_name_ai(original_description)
        
        await db.product_catalog.update_one(
            {"original_description": original_description},
            {
                "$set": {
                    "product_name": normalized_name,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "original_description": original_description,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {
            "original_description": original_description,
            "normalized_name": normalized_name,
            "mapped": True
        }
    except Exception as e:
        logger.error(f"Error mapping product: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/map-all-products")
async def map_all_products(max_items: int = Query(50, le=100)):
    """Mappa automaticamente tutti i prodotti non mappati usando AI."""
    try:
        db = Database.get_db()
        
        # Ottieni descrizioni uniche
        invoices = await db.invoices.find().limit(200).to_list(length=None)
        
        unique_descriptions = set()
        for invoice in invoices:
            for product in invoice.get("products", []) or invoice.get("linee", []):
                desc = product.get("descrizione") or product.get("description", "")
                if desc:
                    unique_descriptions.add(desc)
        
        mapped_count = 0
        for desc in unique_descriptions:
            # Skip se già mappato
            existing = await db.product_catalog.find_one({
                "original_description": desc,
                "product_name": {"$ne": None, "$ne": ""}
            })
            
            if existing:
                continue
            
            # Mappa con AI
            normalized_name = await normalize_product_name_ai(desc)
            
            await db.product_catalog.update_one(
                {"original_description": desc},
                {
                    "$set": {
                        "product_name": normalized_name,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "original_description": desc,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                upsert=True
            )
            mapped_count += 1
            
            if mapped_count >= max_items:
                break
        
        return {"mapped_count": mapped_count, "message": f"Mappati {mapped_count} prodotti"}
    except Exception as e:
        logger.error(f"Error mapping all products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/products")
async def get_products_comparison(
    search: Optional[str] = None, 
    supplier: Optional[str] = None,
    months: int = Query(6, ge=1, le=24)
):
    """
    Ottieni confronto prezzi prodotti.
    
    Args:
        search: Filtro ricerca per nome prodotto
        supplier: Filtro per fornitore specifico
        months: Mesi di storico da considerare (default 6)
    """
    try:
        db = Database.get_db()
        
        # Calcola data limite
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=months * 30)
        
        # Query fatture
        query = {}
        try:
            query["uploaded_at"] = {"$gte": cutoff_date.isoformat()}
        except:
            pass
        
        if supplier:
            query["supplier_name"] = supplier
        
        invoices = await db.invoices.find(query).limit(500).to_list(length=500)
        
        logger.info(f"Processing {len(invoices)} invoices for comparison")
        
        # Carica mappature catalogo
        catalog_items = await db.product_catalog.find({
            "product_name": {"$ne": None, "$ne": ""}
        }).limit(5000).to_list(length=5000)
        
        catalog_lookup = {
            item.get("original_description"): item.get("product_name")
            for item in catalog_items
        }
        
        logger.info(f"Loaded {len(catalog_lookup)} catalog mappings")
        
        # Estrai prodotti
        all_products_data = []
        
        for invoice in invoices:
            products = invoice.get("products", []) or invoice.get("linee", [])
            for product in products:
                desc = product.get("descrizione") or product.get("description", "")
                
                normalized_name = catalog_lookup.get(desc)
                
                if not normalized_name:
                    continue
                
                if search and search.lower() not in normalized_name.lower():
                    continue
                
                # Estrai prezzo unitario
                unit_price = product.get("unit_price") or product.get("prezzo_unitario", 0)
                if not unit_price:
                    try:
                        total = float(product.get("prezzo_totale", 0) or 0)
                        qty = float(product.get("quantita", 1) or 1)
                        unit_price = total / qty if qty > 0 else 0
                    except:
                        unit_price = 0
                
                all_products_data.append({
                    "id": str(uuid.uuid4()),
                    "normalized_name": normalized_name,
                    "original_description": desc,
                    "supplier_name": invoice.get("supplier_name", ""),
                    "price": float(unit_price),
                    "quantity": float(product.get("quantita", product.get("quantity", 1)) or 1),
                    "unit": product.get("unita_misura", product.get("unit", "pz")),
                    "invoice_number": invoice.get("invoice_number", ""),
                    "vat_rate": product.get("aliquota_iva", product.get("vat_rate")),
                    "created_at": invoice.get("uploaded_at", "")
                })
        
        logger.info(f"Extracted {len(all_products_data)} mapped products")
        
        # Raggruppa per nome normalizzato
        grouped = defaultdict(lambda: {"normalized_name": "", "suppliers": []})
        
        for product in all_products_data:
            norm_name = product['normalized_name']
            grouped[norm_name]["normalized_name"] = norm_name
            grouped[norm_name]["suppliers"].append({
                "id": product['id'],
                "supplier_name": product['supplier_name'],
                "price": product['price'],
                "quantity": product['quantity'],
                "unit": product['unit'],
                "original_description": product['original_description'],
                "invoice_number": product['invoice_number'],
                "vat_rate": product.get('vat_rate'),
                "created_at": product['created_at']
            })
        
        # Calcola miglior prezzo
        comparison_data = []
        for norm_name, data in grouped.items():
            suppliers = data["suppliers"]
            if suppliers:
                valid_prices = [s['price'] for s in suppliers if s['price'] and s['price'] > 0]
                best_price = min(valid_prices) if valid_prices else 0
                comparison_data.append({
                    "normalized_name": norm_name,
                    "suppliers": suppliers,
                    "best_price": best_price,
                    "supplier_count": len(set(s['supplier_name'] for s in suppliers))
                })
        
        # Ordina per numero fornitori (più confrontabili prima)
        comparison_data.sort(key=lambda x: -x['supplier_count'])
        
        return {"comparison_data": comparison_data, "total": len(comparison_data)}
    except Exception as e:
        logger.error(f"Error fetching products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CARRELLO ====================

@router.post("/cart/add")
async def add_to_cart(
    product_id: str,
    normalized_name: str,
    original_description: str,
    supplier_name: str,
    price: float,
    quantity: float = 1,
    unit: str = "pz",
    invoice_number: str = "",
    vat_rate: Optional[float] = None
):
    """Aggiungi prodotto al carrello."""
    try:
        db = Database.get_db()
        
        cart_item = {
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "normalized_name": normalized_name,
            "original_description": original_description,
            "supplier_name": supplier_name,
            "price": price,
            "quantity": quantity,
            "unit": unit,
            "invoice_number": invoice_number,
            "vat_rate": vat_rate,
            "selected": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.comparatore_cart.insert_one(cart_item)
        
        return {"message": "Prodotto aggiunto al carrello", "cart_item_id": cart_item["id"]}
    except Exception as e:
        logger.error(f"Error adding to cart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cart")
async def get_cart():
    """Ottieni carrello raggruppato per fornitore."""
    try:
        db = Database.get_db()
        items = await db.comparatore_cart.find({}, {"_id": 0}).to_list(length=None)
        
        cart_by_supplier = defaultdict(lambda: {
            "supplier_name": "",
            "items": [],
            "total": 0.0
        })
        
        for item in items:
            supplier = item['supplier_name']
            cart_by_supplier[supplier]["supplier_name"] = supplier
            cart_by_supplier[supplier]["items"].append(item)
            if item.get('selected', True):
                cart_by_supplier[supplier]["total"] += item['price'] * item['quantity']
        
        return {"cart": list(cart_by_supplier.values())}
    except Exception as e:
        logger.error(f"Error fetching cart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: str):
    """Rimuovi prodotto dal carrello."""
    try:
        db = Database.get_db()
        result = await db.comparatore_cart.delete_one({"id": item_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Prodotto non trovato nel carrello")
        
        return {"message": "Prodotto rimosso dal carrello"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing from cart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cart")
async def clear_cart():
    """Svuota il carrello."""
    try:
        db = Database.get_db()
        await db.comparatore_cart.delete_many({})
        return {"message": "Carrello svuotato"}
    except Exception as e:
        logger.error(f"Error clearing cart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ESCLUSIONI FORNITORI ====================

@router.post("/exclude-supplier")
async def exclude_supplier(supplier_name: str, excluded: bool = True):
    """Aggiungi o rimuovi fornitore dalla lista esclusioni."""
    try:
        db = Database.get_db()
        
        if excluded:
            await db.comparatore_supplier_exclusions.update_one(
                {"supplier_name": supplier_name},
                {"$set": {
                    "supplier_name": supplier_name,
                    "excluded_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
            message = f"Fornitore {supplier_name} escluso"
        else:
            await db.comparatore_supplier_exclusions.delete_one({"supplier_name": supplier_name})
            message = f"Fornitore {supplier_name} riabilitato"
        
        return {"message": message}
    except Exception as e:
        logger.error(f"Error excluding supplier: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/excluded-suppliers")
async def get_excluded_suppliers():
    """Ottieni lista fornitori esclusi."""
    try:
        db = Database.get_db()
        excluded = await db.comparatore_supplier_exclusions.find({}, {"_id": 0}).to_list(length=None)
        return {"excluded_suppliers": [s['supplier_name'] for s in excluded]}
    except Exception as e:
        logger.error(f"Error fetching excluded suppliers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STATISTICHE ====================

@router.get("/stats")
async def get_comparatore_stats():
    """Ottieni statistiche del comparatore."""
    try:
        db = Database.get_db()
        
        # Conta prodotti mappati
        mapped_count = await db.product_catalog.count_documents({
            "product_name": {"$ne": None, "$ne": ""}
        })
        
        # Conta fornitori
        suppliers = await db.invoices.distinct("supplier_name")
        
        # Conta items nel carrello
        cart_count = await db.comparatore_cart.count_documents({})
        
        # Conta fornitori esclusi
        excluded_count = await db.comparatore_supplier_exclusions.count_documents({})
        
        return {
            "mapped_products": mapped_count,
            "total_suppliers": len([s for s in suppliers if s]),
            "cart_items": cart_count,
            "excluded_suppliers": excluded_count
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
