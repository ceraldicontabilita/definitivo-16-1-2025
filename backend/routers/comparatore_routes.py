"""
Router Comparatore Prezzi - Confronto prezzi fornitori.
Parsing fatture, normalizzazione prodotti, carrello acquisti.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import re
import logging
import uuid
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/comparatore", tags=["Comparatore Prezzi"])

# Database reference (set from main server)
db = None

def set_database(database):
    """Set database reference from main server."""
    global db
    db = database


# ============== PYDANTIC MODELS ==============

class ProductMapping(BaseModel):
    original_description: str
    normalized_name: Optional[str] = None
    
    model_config = ConfigDict(extra="ignore")


class CartItem(BaseModel):
    normalized_name: str
    original_description: str
    supplier_name: str
    supplier_vat: Optional[str] = None
    price: float
    unit: Optional[str] = None
    quantity: float = 1
    invoice_date: Optional[str] = None
    
    model_config = ConfigDict(extra="ignore")


class SupplierExclusion(BaseModel):
    supplier_name: str
    exclude: bool = True
    
    model_config = ConfigDict(extra="ignore")


# ============== HELPER FUNCTIONS ==============

def clean_normalized_name(name: str) -> str:
    """Pulisce e normalizza nome prodotto."""
    if not name:
        return ""
    # Rimuove caratteri speciali e spazi multipli
    name = re.sub(r'[^\w\s\-]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip().upper()


def normalize_product_name_simple(description: str) -> str:
    """
    Normalizzazione semplice senza AI.
    Estrae parole chiave significative.
    """
    if not description:
        return "PRODOTTO"
    
    # Rimuovi codici, numeri riferimento
    desc = re.sub(r'\b[A-Z]{2,3}\d{4,}\b', '', description.upper())
    desc = re.sub(r'\bCOD\.?\s*\d+\b', '', desc)
    desc = re.sub(r'\bRIF\.?\s*\d+\b', '', desc)
    
    # Estrai parole significative (> 3 caratteri)
    words = [w for w in desc.split() if len(w) > 3 and not w.isdigit()]
    
    if words:
        # Prendi le prime 3 parole significative
        return ' '.join(words[:3])
    
    return description[:30].strip().upper() if description else "PRODOTTO"


async def normalize_product_name(description: str) -> str:
    """
    Normalizza nome prodotto.
    Usa logica semplice (può essere esteso con AI).
    """
    return normalize_product_name_simple(description)


def parse_fatturapa_xml(xml_content: str) -> Dict[str, Any]:
    """
    Parse FatturaPA XML per comparatore.
    Estrae fornitore, prodotti con prezzi.
    """
    try:
        # Rimuove namespace per semplificare parsing
        xml_clean = re.sub(r'\sxmlns[^"]*"[^"]*"', '', xml_content)
        xml_clean = re.sub(r'<\w+:', '<', xml_clean)
        xml_clean = re.sub(r'</\w+:', '</', xml_clean)
        
        root = ET.fromstring(xml_clean.encode('utf-8'))
        
        result = {
            "supplier_name": "",
            "supplier_vat": "",
            "invoice_number": "",
            "invoice_date": "",
            "total_amount": 0,
            "lines": []
        }
        
        # Cerca fornitore
        for cedente in root.iter():
            if cedente.tag.endswith('CedentePrestatore') or cedente.tag == 'CedentePrestatore':
                for dati in cedente.iter():
                    if 'Denominazione' in dati.tag and dati.text:
                        result["supplier_name"] = dati.text.strip()
                    elif 'IdCodice' in dati.tag and dati.text:
                        result["supplier_vat"] = dati.text.strip()
                break
        
        # Cerca dati fattura
        for dati_gen in root.iter():
            if 'DatiGeneraliDocumento' in dati_gen.tag:
                for child in dati_gen.iter():
                    if 'Numero' in child.tag and child.text:
                        result["invoice_number"] = child.text.strip()
                    elif 'Data' in child.tag and child.text:
                        result["invoice_date"] = child.text.strip()
                    elif 'ImportoTotaleDocumento' in child.tag and child.text:
                        try:
                            result["total_amount"] = float(child.text.replace(',', '.'))
                        except ValueError:
                            pass
                break
        
        # Cerca linee dettaglio
        for det in root.iter():
            if det.tag.endswith('DettaglioLinee') or det.tag == 'DettaglioLinee':
                line = {
                    "description": "",
                    "quantity": 1,
                    "unit": "PZ",
                    "unit_price": 0,
                    "total": 0
                }
                
                for child in det:
                    tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                    
                    if tag == 'Descrizione' and child.text:
                        line["description"] = child.text.strip()
                    elif tag == 'Quantita' and child.text:
                        try:
                            line["quantity"] = float(child.text.replace(',', '.'))
                        except ValueError:
                            pass
                    elif tag == 'UnitaMisura' and child.text:
                        line["unit"] = child.text.strip()
                    elif tag == 'PrezzoUnitario' and child.text:
                        try:
                            line["unit_price"] = float(child.text.replace(',', '.'))
                        except ValueError:
                            pass
                    elif tag == 'PrezzoTotale' and child.text:
                        try:
                            line["total"] = float(child.text.replace(',', '.'))
                        except ValueError:
                            pass
                
                if line["description"]:
                    result["lines"].append(line)
        
        return result
        
    except ET.ParseError as e:
        logger.error(f"XML Parse error: {e}")
        return {"error": f"Errore parsing XML: {str(e)}"}
    except Exception as e:
        logger.error(f"Error parsing FatturaPA: {e}")
        return {"error": f"Errore: {str(e)}"}


# ============== API ENDPOINTS ==============

@router.get("/")
async def comparatore_root():
    """Root endpoint comparatore."""
    return {"message": "Comparatore Prezzi API", "version": "1.0"}


@router.get("/invoices")
async def get_invoices(supplier: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Lista fatture per comparatore.
    Prende dalla collection principale invoices.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    query = {}
    if supplier:
        query["supplier_name"] = {"$regex": supplier, "$options": "i"}
    
    invoices = await db["invoices"].find(query, {"_id": 0}).sort("invoice_date", -1).limit(500).to_list(500)
    
    # Trasforma per compatibilità comparatore
    result = []
    for inv in invoices:
        result.append({
            "id": inv.get("id"),
            "supplier_name": inv.get("supplier_name", ""),
            "supplier_vat": inv.get("supplier_vat", ""),
            "invoice_number": inv.get("invoice_number", ""),
            "invoice_date": inv.get("invoice_date", ""),
            "total_amount": float(inv.get("total_amount", 0) or 0),
            "lines_count": len(inv.get("linee", [])),
            "uploaded_at": inv.get("created_at", "")
        })
    
    return result


@router.get("/suppliers")
async def get_suppliers() -> List[str]:
    """Lista fornitori distinti."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    suppliers = await db["invoices"].distinct("supplier_name")
    return sorted([s for s in suppliers if s])


@router.get("/unmapped-products")
async def get_unmapped_products() -> List[Dict[str, Any]]:
    """
    Prodotti non ancora mappati (senza normalized_name).
    Estrae dalle fatture recenti.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    # Prendi fatture ultimi 6 mesi
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()
    
    invoices = await db["invoices"].find(
        {"created_at": {"$gte": six_months_ago}},
        {"_id": 0, "linee": 1, "supplier_name": 1, "supplier_vat": 1}
    ).limit(200).to_list(200)
    
    # Raccogli descrizioni uniche
    descriptions = {}
    for inv in invoices:
        for line in inv.get("linee", []):
            desc = line.get("descrizione", "")
            if desc and desc not in descriptions:
                descriptions[desc] = {
                    "original_description": desc,
                    "supplier_name": inv.get("supplier_name", ""),
                    "supplier_vat": inv.get("supplier_vat", ""),
                    "unit_price": float(line.get("prezzo_unitario", 0) or 0)
                }
    
    # Verifica quali sono già mappati nel catalogo
    catalog = await db["product_catalog"].find(
        {"product_name": {"$exists": True, "$ne": ""}},
        {"_id": 0, "original_description": 1}
    ).to_list(5000)
    
    mapped_descs = {c.get("original_description") for c in catalog}
    
    # Filtra non mappati
    unmapped = [v for k, v in descriptions.items() if k not in mapped_descs]
    
    return unmapped[:100]  # Max 100


@router.get("/mapped-products")
async def get_mapped_products() -> List[Dict[str, Any]]:
    """Prodotti già mappati con nome normalizzato."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    products = await db["product_catalog"].find(
        {"product_name": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ).limit(1000).to_list(1000)
    
    return products


@router.post("/map-product")
async def map_product(data: ProductMapping) -> Dict[str, Any]:
    """
    Mappa un prodotto singolo.
    Normalizza descrizione e salva nel catalogo.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    original_desc = data.original_description
    if not original_desc:
        raise HTTPException(status_code=400, detail="Descrizione richiesta")
    
    # Normalizza
    if data.normalized_name:
        normalized = clean_normalized_name(data.normalized_name)
    else:
        normalized = await normalize_product_name(original_desc)
    
    # Upsert nel catalogo
    await db["product_catalog"].update_one(
        {"original_description": original_desc},
        {"$set": {
            "original_description": original_desc,
            "product_name": normalized,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "original": original_desc,
        "normalized": normalized
    }


@router.post("/map-all-products")
async def map_all_products(limit: int = 50) -> Dict[str, Any]:
    """
    Mappa automaticamente tutti i prodotti non mappati.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    unmapped = await get_unmapped_products()
    
    results = {
        "processed": 0,
        "mapped": 0,
        "errors": 0
    }
    
    for product in unmapped[:limit]:
        try:
            desc = product.get("original_description", "")
            if not desc:
                continue
            
            normalized = await normalize_product_name(desc)
            
            await db["product_catalog"].update_one(
                {"original_description": desc},
                {"$set": {
                    "original_description": desc,
                    "product_name": normalized,
                    "supplier_name": product.get("supplier_name", ""),
                    "supplier_vat": product.get("supplier_vat", ""),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
            
            results["mapped"] += 1
            results["processed"] += 1
            
        except Exception as e:
            logger.error(f"Error mapping product: {e}")
            results["errors"] += 1
            results["processed"] += 1
    
    return results


@router.get("/products")
async def get_products(
    search: Optional[str] = None,
    supplier: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Prodotti con confronto prezzi.
    Raggruppa per nome normalizzato, trova best price.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    # Carica catalogo prodotti
    catalog = await db["product_catalog"].find(
        {"product_name": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ).to_list(5000)
    
    desc_to_name = {c.get("original_description"): c.get("product_name") for c in catalog}
    
    # Prendi fatture ultimi 6 mesi
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=180)).isoformat()
    
    query = {"created_at": {"$gte": six_months_ago}}
    if supplier:
        query["supplier_name"] = {"$regex": supplier, "$options": "i"}
    
    invoices = await db["invoices"].find(query, {"_id": 0}).limit(1000).to_list(1000)
    
    # Fornitori esclusi
    excluded = await db["comparatore_supplier_exclusions"].distinct("supplier_name")
    
    # Raggruppa prodotti per nome normalizzato
    products_map = {}
    
    for inv in invoices:
        if inv.get("supplier_name") in excluded:
            continue
        
        for line in inv.get("linee", []):
            desc = line.get("descrizione", "")
            normalized = desc_to_name.get(desc, normalize_product_name_simple(desc))
            
            if search and search.upper() not in normalized.upper() and search.upper() not in desc.upper():
                continue
            
            price = float(line.get("prezzo_unitario", 0) or 0)
            if price <= 0:
                continue
            
            if normalized not in products_map:
                products_map[normalized] = {
                    "normalized_name": normalized,
                    "suppliers": [],
                    "best_price": price,
                    "best_supplier": inv.get("supplier_name", ""),
                    "prices_count": 0
                }
            
            products_map[normalized]["suppliers"].append({
                "supplier_name": inv.get("supplier_name", ""),
                "supplier_vat": inv.get("supplier_vat", ""),
                "price": price,
                "unit": line.get("unita_misura", "PZ"),
                "original_description": desc,
                "invoice_date": inv.get("invoice_date", "")
            })
            
            products_map[normalized]["prices_count"] += 1
            
            if price < products_map[normalized]["best_price"]:
                products_map[normalized]["best_price"] = price
                products_map[normalized]["best_supplier"] = inv.get("supplier_name", "")
    
    # Converti a lista e ordina
    result = list(products_map.values())
    result.sort(key=lambda x: x["normalized_name"])
    
    return result[:500]


# ============== CARRELLO ==============

@router.post("/cart/add")
async def add_to_cart(item: CartItem) -> Dict[str, Any]:
    """Aggiunge prodotto al carrello."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    cart_item = {
        "id": str(uuid.uuid4()),
        "normalized_name": item.normalized_name,
        "original_description": item.original_description,
        "supplier_name": item.supplier_name,
        "supplier_vat": item.supplier_vat,
        "price": item.price,
        "unit": item.unit,
        "quantity": item.quantity,
        "invoice_date": item.invoice_date,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["comparatore_cart"].insert_one(cart_item)
    cart_item.pop("_id", None)
    
    return {"success": True, "item": cart_item}


@router.get("/cart")
async def get_cart() -> Dict[str, Any]:
    """Restituisce carrello con raggruppamento per fornitore."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    items = await db["comparatore_cart"].find({}, {"_id": 0}).to_list(500)
    
    # Raggruppa per fornitore
    by_supplier = {}
    for item in items:
        supplier = item.get("supplier_name", "Altro")
        if supplier not in by_supplier:
            by_supplier[supplier] = {
                "supplier": supplier,
                "items": [],
                "subtotal": 0
            }
        by_supplier[supplier]["items"].append(item)
        by_supplier[supplier]["subtotal"] += float(item.get("price", 0) or 0) * float(item.get("quantity", 1) or 1)
    
    total = sum(s["subtotal"] for s in by_supplier.values())
    
    return {
        "by_supplier": list(by_supplier.values()),
        "total_items": len(items),
        "total_amount": round(total, 2)
    }


@router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: str) -> Dict[str, Any]:
    """Rimuove prodotto dal carrello."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    result = await db["comparatore_cart"].delete_one({"id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Elemento non trovato")
    
    return {"success": True, "deleted_id": item_id}


@router.delete("/cart")
async def clear_cart() -> Dict[str, Any]:
    """Svuota carrello."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    result = await db["comparatore_cart"].delete_many({})
    
    return {"success": True, "deleted_count": result.deleted_count}


# ============== ESCLUSIONE FORNITORI ==============

@router.post("/exclude-supplier")
async def exclude_supplier(data: SupplierExclusion) -> Dict[str, Any]:
    """Aggiunge/rimuove fornitore dalla lista esclusioni."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    if data.exclude:
        await db["comparatore_supplier_exclusions"].update_one(
            {"supplier_name": data.supplier_name},
            {"$set": {
                "supplier_name": data.supplier_name,
                "excluded_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True, "message": f"{data.supplier_name} escluso"}
    else:
        await db["comparatore_supplier_exclusions"].delete_one({"supplier_name": data.supplier_name})
        return {"success": True, "message": f"{data.supplier_name} riammesso"}


@router.get("/excluded-suppliers")
async def get_excluded_suppliers() -> List[str]:
    """Lista fornitori esclusi."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database non configurato")
    
    excluded = await db["comparatore_supplier_exclusions"].distinct("supplier_name")
    return excluded
