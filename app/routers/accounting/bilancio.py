"""
Bilancio Router - Stato Patrimoniale e Conto Economico
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Dict, Any
from datetime import datetime
from app.database import Database, Collections
from io import BytesIO
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

COLLECTION_PRIMA_NOTA_CASSA = "prima_nota_cassa"
COLLECTION_PRIMA_NOTA_BANCA = "prima_nota_banca"


@router.get("/stato-patrimoniale")
async def get_stato_patrimoniale(
    anno: int = Query(None, description="Anno di riferimento"),
    data_a: str = Query(None, description="Data fine (YYYY-MM-DD)")
) -> Dict[str, Any]:
    """
    Genera lo Stato Patrimoniale.
    
    ATTIVO:
    - Cassa (saldo prima nota cassa)
    - Banca (saldo prima nota banca)
    - Crediti vs clienti (fatture emesse non pagate)
    
    PASSIVO:
    - Debiti vs fornitori (fatture ricevute non pagate)
    - Capitale e riserve
    """
    db = Database.get_db()
    
    if not anno:
        anno = datetime.now().year
    
    data_fine = data_a or f"{anno}-12-31"
    data_inizio = f"{anno}-01-01"
    
    # === ATTIVO ===
    
    # Cassa
    pipeline_cassa = [
        {"$match": {"data": {"$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    cassa_result = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline_cassa).to_list(1)
    saldo_cassa = 0
    if cassa_result:
        saldo_cassa = cassa_result[0].get("entrate", 0) - cassa_result[0].get("uscite", 0)
    
    # Banca
    pipeline_banca = [
        {"$match": {"data": {"$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    banca_result = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate(pipeline_banca).to_list(1)
    saldo_banca = 0
    if banca_result:
        saldo_banca = banca_result[0].get("entrate", 0) - banca_result[0].get("uscite", 0)
    
    # Crediti (fatture emesse non pagate)
    crediti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "tipo_documento": {"$in": ["TD01", "TD24", "TD26"]},  # Fatture emesse
            "status": {"$ne": "paid"},
            "invoice_date": {"$lte": data_fine}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_crediti = crediti[0]["totale"] if crediti else 0
    
    # === PASSIVO ===
    
    # Debiti (fatture ricevute non pagate)
    debiti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "tipo_documento": {"$nin": ["TD01", "TD24", "TD26"]},  # Fatture ricevute
            "status": {"$ne": "paid"},
            "pagato": {"$ne": True},
            "invoice_date": {"$lte": data_fine}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_debiti = debiti[0]["totale"] if debiti else 0
    
    # Calcoli
    totale_attivo = saldo_cassa + saldo_banca + totale_crediti
    totale_passivo = totale_debiti
    patrimonio_netto = totale_attivo - totale_passivo
    
    return {
        "anno": anno,
        "data_riferimento": data_fine,
        "attivo": {
            "disponibilita_liquide": {
                "cassa": round(saldo_cassa, 2),
                "banca": round(saldo_banca, 2),
                "totale": round(saldo_cassa + saldo_banca, 2)
            },
            "crediti": {
                "crediti_vs_clienti": round(totale_crediti, 2),
                "totale": round(totale_crediti, 2)
            },
            "totale_attivo": round(totale_attivo, 2)
        },
        "passivo": {
            "debiti": {
                "debiti_vs_fornitori": round(totale_debiti, 2),
                "totale": round(totale_debiti, 2)
            },
            "patrimonio_netto": round(patrimonio_netto, 2),
            "totale_passivo": round(totale_debiti + patrimonio_netto, 2)
        }
    }


@router.get("/conto-economico")
async def get_conto_economico(
    anno: int = Query(None, description="Anno di riferimento"),
    mese: int = Query(None, description="Mese (1-12)")
) -> Dict[str, Any]:
    """
    Genera il Conto Economico.
    
    RICAVI:
    - Corrispettivi (vendite)
    - Altri ricavi
    
    COSTI:
    - Acquisti (fatture fornitori)
    - Costi operativi
    """
    db = Database.get_db()
    
    if not anno:
        anno = datetime.now().year
    
    # Periodo
    if mese:
        data_inizio = f"{anno}-{mese:02d}-01"
        if mese == 12:
            data_fine = f"{anno}-12-31"
        else:
            data_fine = f"{anno}-{mese+1:02d}-01"
    else:
        data_inizio = f"{anno}-01-01"
        data_fine = f"{anno}-12-31"
    
    # === RICAVI ===
    
    # Corrispettivi (entrate cassa da corrispettivi)
    corrispettivi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "entrata",
            "$or": [
                {"categoria": {"$regex": "corrisp", "$options": "i"}},
                {"source": "corrispettivo"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_corrispettivi = corrispettivi[0]["totale"] if corrispettivi else 0
    
    # Altri ricavi (altre entrate)
    altri_ricavi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "entrata",
            "$nor": [
                {"categoria": {"$regex": "corrisp", "$options": "i"}},
                {"source": "corrispettivo"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_altri_ricavi = altri_ricavi[0]["totale"] if altri_ricavi else 0
    
    # === COSTI ===
    
    # Acquisti (fatture pagate)
    acquisti_cassa = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita",
            "$or": [
                {"categoria": {"$regex": "fornitore|acquist|fattura", "$options": "i"}},
                {"source": "fattura_pagata"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    
    acquisti_banca = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita"
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    
    totale_acquisti = (acquisti_cassa[0]["totale"] if acquisti_cassa else 0) + \
                      (acquisti_banca[0]["totale"] if acquisti_banca else 0)
    
    # Altri costi
    altri_costi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita",
            "$nor": [
                {"categoria": {"$regex": "fornitore|acquist|fattura", "$options": "i"}},
                {"source": "fattura_pagata"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_altri_costi = altri_costi[0]["totale"] if altri_costi else 0
    
    # Calcoli
    totale_ricavi = totale_corrispettivi + totale_altri_ricavi
    totale_costi = totale_acquisti + totale_altri_costi
    utile_perdita = totale_ricavi - totale_costi
    
    return {
        "anno": anno,
        "mese": mese,
        "periodo": {
            "da": data_inizio,
            "a": data_fine
        },
        "ricavi": {
            "corrispettivi": round(totale_corrispettivi, 2),
            "altri_ricavi": round(totale_altri_ricavi, 2),
            "totale_ricavi": round(totale_ricavi, 2)
        },
        "costi": {
            "acquisti": round(totale_acquisti, 2),
            "altri_costi": round(totale_altri_costi, 2),
            "totale_costi": round(totale_costi, 2)
        },
        "risultato": {
            "utile_perdita": round(utile_perdita, 2),
            "tipo": "utile" if utile_perdita >= 0 else "perdita"
        }
    }


@router.get("/riepilogo")
async def get_riepilogo_bilancio(anno: int = Query(None)) -> Dict[str, Any]:
    """Riepilogo completo bilancio: stato patrimoniale + conto economico."""
    if not anno:
        anno = datetime.now().year
    
    stato_patrimoniale = await get_stato_patrimoniale(anno=anno)
    conto_economico = await get_conto_economico(anno=anno)
    
    return {
        "anno": anno,
        "stato_patrimoniale": stato_patrimoniale,
        "conto_economico": conto_economico
    }



@router.get("/export-pdf")
async def export_bilancio_pdf(anno: int = Query(None)):
    """Esporta Bilancio in PDF."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab non installato")
    
    if not anno:
        anno = datetime.now().year
    
    # Carica dati
    stato_patrimoniale = await get_stato_patrimoniale(anno=anno)
    conto_economico = await get_conto_economico(anno=anno)
    
    # Crea PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=14, spaceAfter=10, spaceBefore=15)
    
    elements = []
    
    # Titolo
    elements.append(Paragraph(f"BILANCIO {anno}", title_style))
    elements.append(Paragraph(f"Generato il {datetime.now().strftime('%d/%m/%Y')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # === STATO PATRIMONIALE ===
    elements.append(Paragraph("STATO PATRIMONIALE", section_style))
    
    sp = stato_patrimoniale
    sp_data = [
        ['ATTIVO', '', 'PASSIVO', ''],
        ['Cassa', f"€ {sp['attivo']['disponibilita_liquide']['cassa']:,.2f}", 
         'Debiti vs Fornitori', f"€ {sp['passivo']['debiti']['debiti_vs_fornitori']:,.2f}"],
        ['Banca', f"€ {sp['attivo']['disponibilita_liquide']['banca']:,.2f}", '', ''],
        ['Crediti vs Clienti', f"€ {sp['attivo']['crediti']['crediti_vs_clienti']:,.2f}", 
         'Patrimonio Netto', f"€ {sp['passivo']['patrimonio_netto']:,.2f}"],
        ['', '', '', ''],
        ['TOTALE ATTIVO', f"€ {sp['attivo']['totale_attivo']:,.2f}", 
         'TOTALE PASSIVO', f"€ {sp['passivo']['totale_passivo']:,.2f}"]
    ]
    
    sp_table = Table(sp_data, colWidths=[5*cm, 4*cm, 5*cm, 4*cm])
    sp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#dcfce7')),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor('#fee2e2')),
        ('BACKGROUND', (0, -1), (1, -1), colors.HexColor('#22c55e')),
        ('BACKGROUND', (2, -1), (3, -1), colors.HexColor('#ef4444')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(sp_table)
    elements.append(Spacer(1, 30))
    
    # === CONTO ECONOMICO ===
    elements.append(Paragraph("CONTO ECONOMICO", section_style))
    
    ce = conto_economico
    ce_data = [
        ['RICAVI', ''],
        ['Corrispettivi (Vendite)', f"€ {ce['ricavi']['corrispettivi']:,.2f}"],
        ['Altri Ricavi', f"€ {ce['ricavi']['altri_ricavi']:,.2f}"],
        ['TOTALE RICAVI', f"€ {ce['ricavi']['totale_ricavi']:,.2f}"],
        ['', ''],
        ['COSTI', ''],
        ['Acquisti (Fatture Fornitori)', f"€ {ce['costi']['acquisti']:,.2f}"],
        ['Altri Costi Operativi', f"€ {ce['costi']['altri_costi']:,.2f}"],
        ['TOTALE COSTI', f"€ {ce['costi']['totale_costi']:,.2f}"],
        ['', ''],
        ['RISULTATO', f"€ {ce['risultato']['utile_perdita']:,.2f}"]
    ]
    
    ce_table = Table(ce_data, colWidths=[10*cm, 6*cm])
    ce_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dcfce7')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#22c55e')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#fee2e2')),
        ('BACKGROUND', (0, 8), (-1, 8), colors.HexColor('#ef4444')),
        ('BACKGROUND', (0, 10), (-1, 10), colors.HexColor('#1e293b') if ce['risultato']['utile_perdita'] >= 0 else colors.HexColor('#dc2626')),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.white),
        ('TEXTCOLOR', (0, 8), (-1, 8), colors.white),
        ('TEXTCOLOR', (0, 10), (-1, 10), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
        ('FONTNAME', (0, 5), (-1, 5), 'Helvetica-Bold'),
        ('FONTNAME', (0, 8), (-1, 8), 'Helvetica-Bold'),
        ('FONTNAME', (0, 10), (-1, 10), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(ce_table)
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=bilancio_{anno}.pdf"}
    )



@router.get("/confronto-annuale")
async def get_confronto_annuale(
    anno_corrente: int = Query(..., description="Anno corrente"),
    anno_precedente: int = Query(None, description="Anno precedente (default: anno_corrente - 1)")
) -> Dict[str, Any]:
    """
    Confronto anno su anno del Conto Economico.
    Mostra variazioni assolute e percentuali tra due anni.
    """
    if not anno_precedente:
        anno_precedente = anno_corrente - 1
    
    # Ottieni dati per entrambi gli anni usando le funzioni helper
    ce_corrente = await _get_conto_economico_data(anno_corrente)
    ce_precedente = await _get_conto_economico_data(anno_precedente)
    
    sp_corrente = await _get_stato_patrimoniale_data(anno_corrente)
    sp_precedente = await _get_stato_patrimoniale_data(anno_precedente)
    
    def calc_variazione(attuale: float, precedente: float) -> Dict[str, Any]:
        """Calcola variazione assoluta e percentuale."""
        variazione_abs = attuale - precedente
        variazione_pct = ((attuale - precedente) / precedente * 100) if precedente != 0 else 0
        return {
            "attuale": round(attuale, 2),
            "precedente": round(precedente, 2),
            "variazione": round(variazione_abs, 2),
            "variazione_pct": round(variazione_pct, 1),
            "trend": "up" if variazione_abs > 0 else ("down" if variazione_abs < 0 else "stable")
        }
    
    # Confronto Conto Economico
    confronto_ce = {
        "ricavi": {
            "corrispettivi": calc_variazione(
                ce_corrente["ricavi"]["corrispettivi"],
                ce_precedente["ricavi"]["corrispettivi"]
            ),
            "altri_ricavi": calc_variazione(
                ce_corrente["ricavi"]["altri_ricavi"],
                ce_precedente["ricavi"]["altri_ricavi"]
            ),
            "totale_ricavi": calc_variazione(
                ce_corrente["ricavi"]["totale"],
                ce_precedente["ricavi"]["totale"]
            )
        },
        "costi": {
            "acquisti": calc_variazione(
                ce_corrente["costi"]["acquisti"],
                ce_precedente["costi"]["acquisti"]
            ),
            "costi_operativi": calc_variazione(
                ce_corrente["costi"]["costi_operativi"],
                ce_precedente["costi"]["costi_operativi"]
            ),
            "totale_costi": calc_variazione(
                ce_corrente["costi"]["totale"],
                ce_precedente["costi"]["totale"]
            )
        },
        "risultato": {
            "risultato_operativo": calc_variazione(
                ce_corrente["risultato"]["risultato_operativo"],
                ce_precedente["risultato"]["risultato_operativo"]
            ),
            "utile_lordo": calc_variazione(
                ce_corrente["risultato"]["utile_lordo"],
                ce_precedente["risultato"]["utile_lordo"]
            ),
            "utile_netto": calc_variazione(
                ce_corrente["risultato"]["utile_netto"],
                ce_precedente["risultato"]["utile_netto"]
            )
        }
    }
    
    # Confronto Stato Patrimoniale
    confronto_sp = {
        "attivo": {
            "cassa": calc_variazione(
                sp_corrente["attivo"]["disponibilita_liquide"]["cassa"],
                sp_precedente["attivo"]["disponibilita_liquide"]["cassa"]
            ),
            "banca": calc_variazione(
                sp_corrente["attivo"]["disponibilita_liquide"]["banca"],
                sp_precedente["attivo"]["disponibilita_liquide"]["banca"]
            ),
            "crediti": calc_variazione(
                sp_corrente["attivo"]["crediti"]["totale"],
                sp_precedente["attivo"]["crediti"]["totale"]
            ),
            "totale_attivo": calc_variazione(
                sp_corrente["attivo"]["totale_attivo"],
                sp_precedente["attivo"]["totale_attivo"]
            )
        },
        "passivo": {
            "debiti": calc_variazione(
                sp_corrente["passivo"]["debiti"]["totale"],
                sp_precedente["passivo"]["debiti"]["totale"]
            ),
            "patrimonio_netto": calc_variazione(
                sp_corrente["passivo"]["patrimonio_netto"],
                sp_precedente["passivo"]["patrimonio_netto"]
            )
        }
    }
    
    # KPI di performance
    margine_lordo_corrente = (ce_corrente["risultato"]["utile_lordo"] / ce_corrente["ricavi"]["totale"] * 100) if ce_corrente["ricavi"]["totale"] > 0 else 0
    margine_lordo_precedente = (ce_precedente["risultato"]["utile_lordo"] / ce_precedente["ricavi"]["totale"] * 100) if ce_precedente["ricavi"]["totale"] > 0 else 0
    
    roi_corrente = (ce_corrente["risultato"]["utile_netto"] / sp_corrente["attivo"]["totale_attivo"] * 100) if sp_corrente["attivo"]["totale_attivo"] > 0 else 0
    roi_precedente = (ce_precedente["risultato"]["utile_netto"] / sp_precedente["attivo"]["totale_attivo"] * 100) if sp_precedente["attivo"]["totale_attivo"] > 0 else 0
    
    kpi = {
        "margine_lordo_pct": calc_variazione(margine_lordo_corrente, margine_lordo_precedente),
        "roi_pct": calc_variazione(roi_corrente, roi_precedente),
        "crescita_ricavi_pct": round(confronto_ce["ricavi"]["totale_ricavi"]["variazione_pct"], 1),
        "crescita_costi_pct": round(confronto_ce["costi"]["totale_costi"]["variazione_pct"], 1)
    }
    
    return {
        "anno_corrente": anno_corrente,
        "anno_precedente": anno_precedente,
        "conto_economico": confronto_ce,
        "stato_patrimoniale": confronto_sp,
        "kpi": kpi,
        "sintesi": {
            "ricavi_trend": "📈 In crescita" if confronto_ce["ricavi"]["totale_ricavi"]["trend"] == "up" else ("📉 In calo" if confronto_ce["ricavi"]["totale_ricavi"]["trend"] == "down" else "➡️ Stabile"),
            "utile_trend": "📈 In crescita" if confronto_ce["risultato"]["utile_netto"]["trend"] == "up" else ("📉 In calo" if confronto_ce["risultato"]["utile_netto"]["trend"] == "down" else "➡️ Stabile"),
            "liquidita_trend": "📈 In crescita" if confronto_sp["attivo"]["totale_attivo"]["trend"] == "up" else ("📉 In calo" if confronto_sp["attivo"]["totale_attivo"]["trend"] == "down" else "➡️ Stabile")
        }
    }


# Helper functions per evitare problemi con Query params
async def _get_stato_patrimoniale_data(anno: int) -> Dict[str, Any]:
    """Helper interno per ottenere stato patrimoniale."""
    db = Database.get_db()
    
    data_fine = f"{anno}-12-31"
    
    # Cassa
    pipeline_cassa = [
        {"$match": {"data": {"$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    cassa_result = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate(pipeline_cassa).to_list(1)
    saldo_cassa = 0
    if cassa_result:
        saldo_cassa = cassa_result[0].get("entrate", 0) - cassa_result[0].get("uscite", 0)
    
    # Banca
    pipeline_banca = [
        {"$match": {"data": {"$lte": data_fine}}},
        {"$group": {
            "_id": None,
            "entrate": {"$sum": {"$cond": [{"$eq": ["$tipo", "entrata"]}, "$importo", 0]}},
            "uscite": {"$sum": {"$cond": [{"$eq": ["$tipo", "uscita"]}, "$importo", 0]}}
        }}
    ]
    banca_result = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate(pipeline_banca).to_list(1)
    saldo_banca = 0
    if banca_result:
        saldo_banca = banca_result[0].get("entrate", 0) - banca_result[0].get("uscite", 0)
    
    # Crediti
    crediti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "tipo_documento": {"$in": ["TD01", "TD24", "TD26"]},
            "status": {"$ne": "paid"},
            "invoice_date": {"$lte": data_fine}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_crediti = crediti[0]["totale"] if crediti else 0
    
    # Debiti
    debiti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "tipo_documento": {"$nin": ["TD01", "TD24", "TD26"]},
            "status": {"$ne": "paid"},
            "pagato": {"$ne": True},
            "invoice_date": {"$lte": data_fine}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_debiti = debiti[0]["totale"] if debiti else 0
    
    totale_attivo = saldo_cassa + saldo_banca + totale_crediti
    totale_passivo = totale_debiti
    patrimonio_netto = totale_attivo - totale_passivo
    
    return {
        "anno": anno,
        "attivo": {
            "disponibilita_liquide": {
                "cassa": round(saldo_cassa, 2),
                "banca": round(saldo_banca, 2),
                "totale": round(saldo_cassa + saldo_banca, 2)
            },
            "crediti": {
                "totale": round(totale_crediti, 2)
            },
            "totale_attivo": round(totale_attivo, 2)
        },
        "passivo": {
            "debiti": {
                "totale": round(totale_debiti, 2)
            },
            "patrimonio_netto": round(patrimonio_netto, 2)
        }
    }


async def _get_conto_economico_data(anno: int) -> Dict[str, Any]:
    """Helper interno per ottenere conto economico."""
    db = Database.get_db()
    
    data_inizio = f"{anno}-01-01"
    data_fine = f"{anno}-12-31"
    
    # Corrispettivi
    corrispettivi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "entrata",
            "$or": [
                {"categoria": {"$regex": "corrisp", "$options": "i"}},
                {"source": "corrispettivo"}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_corrispettivi = corrispettivi[0]["totale"] if corrispettivi else 0
    
    # Altri ricavi
    altri_ricavi = await db[COLLECTION_PRIMA_NOTA_CASSA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "entrata",
            "categoria": {"$not": {"$regex": "corrisp", "$options": "i"}},
            "source": {"$ne": "corrispettivo"}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_altri_ricavi = altri_ricavi[0]["totale"] if altri_ricavi else 0
    
    # Acquisti (fatture)
    acquisti = await db[Collections.INVOICES].aggregate([
        {"$match": {
            "$or": [
                {"data_ricezione": {"$gte": data_inizio, "$lte": data_fine}},
                {"invoice_date": {"$gte": data_inizio, "$lte": data_fine}}
            ]
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    totale_acquisti = acquisti[0]["totale"] if acquisti else 0
    
    # Costi operativi (uscite banca/cassa non fatture)
    costi_op = await db[COLLECTION_PRIMA_NOTA_BANCA].aggregate([
        {"$match": {
            "data": {"$gte": data_inizio, "$lte": data_fine},
            "tipo": "uscita",
            "categoria": {"$nin": ["Fatture", "Fornitori", "Stipendi"]}
        }},
        {"$group": {"_id": None, "totale": {"$sum": "$importo"}}}
    ]).to_list(1)
    totale_costi_op = costi_op[0]["totale"] if costi_op else 0
    
    totale_ricavi = totale_corrispettivi + totale_altri_ricavi
    totale_costi = totale_acquisti + totale_costi_op
    risultato_operativo = totale_ricavi - totale_costi
    
    return {
        "anno": anno,
        "ricavi": {
            "corrispettivi": round(totale_corrispettivi, 2),
            "altri_ricavi": round(totale_altri_ricavi, 2),
            "totale": round(totale_ricavi, 2)
        },
        "costi": {
            "acquisti": round(totale_acquisti, 2),
            "costi_operativi": round(totale_costi_op, 2),
            "totale": round(totale_costi, 2)
        },
        "risultato": {
            "risultato_operativo": round(risultato_operativo, 2),
            "utile_lordo": round(risultato_operativo, 2),
            "utile_netto": round(risultato_operativo * 0.76, 2)  # IRES 24% approx
        }
    }



@router.get("/export/pdf/confronto")
async def export_confronto_pdf(
    anno_corrente: int = Query(...),
    anno_precedente: int = Query(None)
) -> StreamingResponse:
    """
    Esporta il bilancio comparativo anno su anno in PDF.
    """
    if not anno_precedente:
        anno_precedente = anno_corrente - 1
    
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab non installato")
    
    # Ottieni dati confronto
    confronto = await get_confronto_annuale(anno_corrente=anno_corrente, anno_precedente=anno_precedente)
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=1.5*cm, rightMargin=1.5*cm)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor('#1e40af'), spaceAfter=20)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#374151'), spaceAfter=10)
    
    # Titolo
    elements.append(Paragraph("📊 Bilancio Comparativo", title_style))
    elements.append(Paragraph(f"<b>{anno_precedente}</b> vs <b>{anno_corrente}</b>", subtitle_style))
    elements.append(Spacer(1, 20))
    
    # Helper per formattare
    def fmt_eur(val):
        return f"€ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    def fmt_pct(val):
        return f"{val:+.1f}%"
    
    def get_trend_symbol(trend):
        if trend == "up": return "▲"
        if trend == "down": return "▼"
        return "="
    
    # CONTO ECONOMICO
    elements.append(Paragraph("📈 CONTO ECONOMICO", subtitle_style))
    
    ce = confronto["conto_economico"]
    ce_data = [
        ["Voce", f"{anno_precedente}", f"{anno_corrente}", "Variazione", "%"],
        ["RICAVI", "", "", "", ""],
        ["  Corrispettivi", fmt_eur(ce["ricavi"]["corrispettivi"]["precedente"]), fmt_eur(ce["ricavi"]["corrispettivi"]["attuale"]), fmt_eur(ce["ricavi"]["corrispettivi"]["variazione"]), fmt_pct(ce["ricavi"]["corrispettivi"]["variazione_pct"])],
        ["  Altri ricavi", fmt_eur(ce["ricavi"]["altri_ricavi"]["precedente"]), fmt_eur(ce["ricavi"]["altri_ricavi"]["attuale"]), fmt_eur(ce["ricavi"]["altri_ricavi"]["variazione"]), fmt_pct(ce["ricavi"]["altri_ricavi"]["variazione_pct"])],
        ["  TOTALE RICAVI", fmt_eur(ce["ricavi"]["totale_ricavi"]["precedente"]), fmt_eur(ce["ricavi"]["totale_ricavi"]["attuale"]), fmt_eur(ce["ricavi"]["totale_ricavi"]["variazione"]), fmt_pct(ce["ricavi"]["totale_ricavi"]["variazione_pct"])],
        ["COSTI", "", "", "", ""],
        ["  Acquisti", fmt_eur(ce["costi"]["acquisti"]["precedente"]), fmt_eur(ce["costi"]["acquisti"]["attuale"]), fmt_eur(ce["costi"]["acquisti"]["variazione"]), fmt_pct(ce["costi"]["acquisti"]["variazione_pct"])],
        ["  Costi operativi", fmt_eur(ce["costi"]["costi_operativi"]["precedente"]), fmt_eur(ce["costi"]["costi_operativi"]["attuale"]), fmt_eur(ce["costi"]["costi_operativi"]["variazione"]), fmt_pct(ce["costi"]["costi_operativi"]["variazione_pct"])],
        ["  TOTALE COSTI", fmt_eur(ce["costi"]["totale_costi"]["precedente"]), fmt_eur(ce["costi"]["totale_costi"]["attuale"]), fmt_eur(ce["costi"]["totale_costi"]["variazione"]), fmt_pct(ce["costi"]["totale_costi"]["variazione_pct"])],
        ["RISULTATO", "", "", "", ""],
        ["  Utile lordo", fmt_eur(ce["risultato"]["utile_lordo"]["precedente"]), fmt_eur(ce["risultato"]["utile_lordo"]["attuale"]), fmt_eur(ce["risultato"]["utile_lordo"]["variazione"]), fmt_pct(ce["risultato"]["utile_lordo"]["variazione_pct"])],
        ["  Utile netto", fmt_eur(ce["risultato"]["utile_netto"]["precedente"]), fmt_eur(ce["risultato"]["utile_netto"]["attuale"]), fmt_eur(ce["risultato"]["utile_netto"]["variazione"]), fmt_pct(ce["risultato"]["utile_netto"]["variazione_pct"])],
    ]
    
    ce_table = Table(ce_data, colWidths=[5*cm, 3.5*cm, 3.5*cm, 3*cm, 2*cm])
    ce_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f0f9ff')),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#fef2f2')),
        ('BACKGROUND', (0, 9), (-1, 9), colors.HexColor('#f0fdf4')),
        ('FONTNAME', (0, 4), (-1, 4), 'Helvetica-Bold'),
        ('FONTNAME', (0, 8), (-1, 8), 'Helvetica-Bold'),
        ('FONTNAME', (0, 11), (-1, 11), 'Helvetica-Bold'),
    ]))
    elements.append(ce_table)
    elements.append(Spacer(1, 30))
    
    # STATO PATRIMONIALE
    elements.append(Paragraph("🏦 STATO PATRIMONIALE", subtitle_style))
    
    sp = confronto["stato_patrimoniale"]
    sp_data = [
        ["Voce", f"{anno_precedente}", f"{anno_corrente}", "Variazione", "%"],
        ["ATTIVO", "", "", "", ""],
        ["  Cassa", fmt_eur(sp["attivo"]["cassa"]["precedente"]), fmt_eur(sp["attivo"]["cassa"]["attuale"]), fmt_eur(sp["attivo"]["cassa"]["variazione"]), fmt_pct(sp["attivo"]["cassa"]["variazione_pct"])],
        ["  Banca", fmt_eur(sp["attivo"]["banca"]["precedente"]), fmt_eur(sp["attivo"]["banca"]["attuale"]), fmt_eur(sp["attivo"]["banca"]["variazione"]), fmt_pct(sp["attivo"]["banca"]["variazione_pct"])],
        ["  Crediti", fmt_eur(sp["attivo"]["crediti"]["precedente"]), fmt_eur(sp["attivo"]["crediti"]["attuale"]), fmt_eur(sp["attivo"]["crediti"]["variazione"]), fmt_pct(sp["attivo"]["crediti"]["variazione_pct"])],
        ["  TOTALE ATTIVO", fmt_eur(sp["attivo"]["totale_attivo"]["precedente"]), fmt_eur(sp["attivo"]["totale_attivo"]["attuale"]), fmt_eur(sp["attivo"]["totale_attivo"]["variazione"]), fmt_pct(sp["attivo"]["totale_attivo"]["variazione_pct"])],
        ["PASSIVO", "", "", "", ""],
        ["  Debiti", fmt_eur(sp["passivo"]["debiti"]["precedente"]), fmt_eur(sp["passivo"]["debiti"]["attuale"]), fmt_eur(sp["passivo"]["debiti"]["variazione"]), fmt_pct(sp["passivo"]["debiti"]["variazione_pct"])],
        ["  Patrimonio netto", fmt_eur(sp["passivo"]["patrimonio_netto"]["precedente"]), fmt_eur(sp["passivo"]["patrimonio_netto"]["attuale"]), fmt_eur(sp["passivo"]["patrimonio_netto"]["variazione"]), fmt_pct(sp["passivo"]["patrimonio_netto"]["variazione_pct"])],
    ]
    
    sp_table = Table(sp_data, colWidths=[5*cm, 3.5*cm, 3.5*cm, 3*cm, 2*cm])
    sp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f0fdf4')),
        ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#fef2f2')),
        ('FONTNAME', (0, 5), (-1, 5), 'Helvetica-Bold'),
        ('FONTNAME', (0, 8), (-1, 8), 'Helvetica-Bold'),
    ]))
    elements.append(sp_table)
    elements.append(Spacer(1, 30))
    
    # KPI
    elements.append(Paragraph("📊 INDICATORI DI PERFORMANCE", subtitle_style))
    
    kpi = confronto["kpi"]
    sintesi = confronto["sintesi"]
    
    kpi_text = f"""
    <b>Margine Lordo:</b> {kpi['margine_lordo_pct']['attuale']:.1f}% ({fmt_pct(kpi['margine_lordo_pct']['variazione_pct'])} vs anno prec.)<br/>
    <b>ROI:</b> {kpi['roi_pct']['attuale']:.1f}% ({fmt_pct(kpi['roi_pct']['variazione_pct'])} vs anno prec.)<br/>
    <b>Crescita Ricavi:</b> {fmt_pct(kpi['crescita_ricavi_pct'])}<br/>
    <b>Crescita Costi:</b> {fmt_pct(kpi['crescita_costi_pct'])}<br/><br/>
    <b>Sintesi:</b><br/>
    • Ricavi: {sintesi['ricavi_trend']}<br/>
    • Utile: {sintesi['utile_trend']}<br/>
    • Liquidità: {sintesi['liquidita_trend']}
    """
    
    elements.append(Paragraph(kpi_text, styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 40))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.gray)
    elements.append(Paragraph(f"Documento generato il {datetime.now().strftime('%d/%m/%Y %H:%M')} - Azienda Semplice ERP", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"Bilancio_Comparativo_{anno_precedente}_vs_{anno_corrente}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
