"""
Router per generazione Report PDF automatici.

Genera PDF per:
- Prima Nota mensile
- Riepilogo fatture
- Estratto conto
- Report commercialista
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from calendar import monthrange
import io
import logging

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

MESI_NOMI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
             'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']


def format_euro(value):
    """Formatta importo in euro."""
    try:
        return f"€ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "€ 0,00"


def create_header(styles):
    """Crea header standard per i report."""
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1e293b')
    )
    return title_style


@router.get("/prima-nota")
async def genera_pdf_prima_nota(
    anno: int = Query(...),
    mese: int = Query(...)
) -> StreamingResponse:
    """Genera PDF della Prima Nota mensile."""
    db = Database.get_db()
    
    _, ultimo_giorno = monthrange(anno, mese)
    data_inizio = f"{anno}-{mese:02d}-01"
    data_fine = f"{anno}-{mese:02d}-{ultimo_giorno:02d}"
    mese_nome = MESI_NOMI[mese - 1]
    
    # Recupera movimenti
    movimenti = await db["prima_nota"].find({
        "data": {"$gte": data_inizio, "$lte": data_fine}
    }, {"_id": 0}).sort("data", 1).to_list(1000)
    
    # Crea PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []
    
    # Titolo
    title_style = create_header(styles)
    elements.append(Paragraph(f"PRIMA NOTA - {mese_nome} {anno}", title_style))
    elements.append(Spacer(1, 10))
    
    # Info generazione
    info_style = ParagraphStyle('Info', fontSize=9, textColor=colors.gray)
    elements.append(Paragraph(f"Generato il {datetime.now().strftime('%d/%m/%Y %H:%M')}", info_style))
    elements.append(Spacer(1, 20))
    
    # Tabella movimenti
    if movimenti:
        data = [['Data', 'Descrizione', 'Tipo', 'Importo']]
        tot_entrate = 0
        tot_uscite = 0
        
        for m in movimenti:
            importo = float(m.get('importo', 0) or 0)
            if m.get('tipo') == 'entrata':
                tot_entrate += importo
            else:
                tot_uscite += abs(importo)
            
            data.append([
                m.get('data', '')[:10] if m.get('data') else '',
                (m.get('descrizione', '') or '')[:40],
                m.get('tipo', '').upper(),
                format_euro(importo)
            ])
        
        # Totali
        data.append(['', '', '', ''])
        data.append(['', 'TOTALE ENTRATE', '', format_euro(tot_entrate)])
        data.append(['', 'TOTALE USCITE', '', format_euro(tot_uscite)])
        data.append(['', 'SALDO', '', format_euro(tot_entrate - tot_uscite)])
        
        table = Table(data, colWidths=[2.5*cm, 9*cm, 2.5*cm, 3*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -5), 0.5, colors.lightgrey),
            ('FONTNAME', (0, -3), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f9ff')),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("Nessun movimento nel periodo selezionato.", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=prima_nota_{mese_nome.lower()}_{anno}.pdf'}
    )


@router.get("/fatture")
async def genera_pdf_fatture(
    anno: int = Query(...),
    mese: Optional[int] = None,
    tipo: str = Query("ricevute", description="ricevute o emesse")
) -> StreamingResponse:
    """Genera PDF riepilogo fatture."""
    db = Database.get_db()
    
    collection = "fatture_ricevute" if tipo == "ricevute" else "fatture_emesse"
    
    # Query
    query = {}
    if mese:
        _, ultimo_giorno = monthrange(anno, mese)
        data_inizio = f"{anno}-{mese:02d}-01"
        data_fine = f"{anno}-{mese:02d}-{ultimo_giorno:02d}"
        query["$or"] = [
            {"data_ricezione": {"$gte": data_inizio, "$lte": data_fine}},
            {"data_fattura": {"$gte": data_inizio, "$lte": data_fine}},
            {"data": {"$gte": data_inizio, "$lte": data_fine}}
        ]
        periodo = f"{MESI_NOMI[mese-1]} {anno}"
    else:
        periodo = str(anno)
    
    fatture = await db[collection].find(query, {"_id": 0}).sort("data_fattura", 1).to_list(1000)
    
    # Crea PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []
    
    # Titolo
    title_style = create_header(styles)
    titolo = f"FATTURE {'RICEVUTE' if tipo == 'ricevute' else 'EMESSE'} - {periodo}"
    elements.append(Paragraph(titolo, title_style))
    elements.append(Spacer(1, 20))
    
    if fatture:
        data = [['Data', 'Numero', 'Fornitore/Cliente', 'Imponibile', 'IVA', 'Totale']]
        tot_imponibile = 0
        tot_iva = 0
        tot_totale = 0
        
        for f in fatture:
            imponibile = float(f.get('imponibile', 0) or f.get('importo_imponibile', 0) or 0)
            iva = float(f.get('iva', 0) or f.get('importo_iva', 0) or 0)
            totale = float(f.get('totale', 0) or f.get('importo_totale', 0) or imponibile + iva)
            
            tot_imponibile += imponibile
            tot_iva += iva
            tot_totale += totale
            
            data.append([
                (f.get('data_fattura', '') or f.get('data', ''))[:10],
                f.get('numero_fattura', '') or f.get('numero', ''),
                (f.get('fornitore', '') or f.get('cliente', '') or f.get('ragione_sociale', ''))[:25],
                format_euro(imponibile),
                format_euro(iva),
                format_euro(totale)
            ])
        
        # Totali
        data.append(['', '', 'TOTALI', format_euro(tot_imponibile), format_euro(tot_iva), format_euro(tot_totale)])
        
        table = Table(data, colWidths=[2*cm, 2.5*cm, 5*cm, 2.5*cm, 2*cm, 3*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -2), 0.5, colors.lightgrey),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#ecfdf5')),
        ]))
        elements.append(table)
        
        # Riepilogo
        elements.append(Spacer(1, 30))
        elements.append(Paragraph(f"<b>Totale fatture:</b> {len(fatture)}", styles['Normal']))
    else:
        elements.append(Paragraph("Nessuna fattura nel periodo selezionato.", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"fatture_{tipo}_{periodo.lower().replace(' ', '_')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@router.get("/report-commercialista")
async def genera_pdf_commercialista(
    anno: int = Query(...),
    mese: int = Query(...)
) -> StreamingResponse:
    """Genera PDF completo per il commercialista."""
    db = Database.get_db()
    
    _, ultimo_giorno = monthrange(anno, mese)
    data_inizio = f"{anno}-{mese:02d}-01"
    data_fine = f"{anno}-{mese:02d}-{ultimo_giorno:02d}"
    mese_nome = MESI_NOMI[mese - 1]
    
    # Raccogli tutti i dati
    fatture_ric = await db["fatture_ricevute"].find({
        "data_ricezione": {"$gte": data_inizio, "$lte": data_fine}
    }, {"_id": 0}).to_list(500)
    
    fatture_em = await db["fatture_emesse"].find({
        "data_fattura": {"$gte": data_inizio, "$lte": data_fine}
    }, {"_id": 0}).to_list(500)
    
    corrispettivi = await db["corrispettivi"].find({
        "data": {"$gte": data_inizio, "$lte": data_fine}
    }, {"_id": 0}).to_list(100)
    
    prima_nota = await db["prima_nota"].find({
        "data": {"$gte": data_inizio, "$lte": data_fine}
    }, {"_id": 0}).to_list(1000)
    
    # Calcoli
    tot_fatt_ric = sum(float(f.get('totale', 0) or 0) for f in fatture_ric)
    tot_iva_ric = sum(float(f.get('iva', 0) or 0) for f in fatture_ric)
    tot_fatt_em = sum(float(f.get('importo_totale', 0) or 0) for f in fatture_em)
    tot_iva_em = sum(float(f.get('importo_iva', 0) or 0) for f in fatture_em)
    tot_corr = sum(float(c.get('totale', 0) or 0) for c in corrispettivi)
    entrate = sum(float(m.get('importo', 0) or 0) for m in prima_nota if m.get('tipo') == 'entrata')
    uscite = sum(abs(float(m.get('importo', 0) or 0)) for m in prima_nota if m.get('tipo') == 'uscita')
    
    # Crea PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []
    
    # Titolo
    title_style = create_header(styles)
    elements.append(Paragraph(f"REPORT CONTABILE - {mese_nome} {anno}", title_style))
    elements.append(Spacer(1, 10))
    
    subtitle_style = ParagraphStyle('Subtitle', fontSize=10, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph(f"Periodo: {data_inizio} - {data_fine}", subtitle_style))
    elements.append(Spacer(1, 30))
    
    # Sezione 1: Riepilogo
    section_style = ParagraphStyle('Section', fontSize=12, fontName='Helvetica-Bold', spaceAfter=10, textColor=colors.HexColor('#1e293b'))
    elements.append(Paragraph("📊 RIEPILOGO GENERALE", section_style))
    
    riepilogo_data = [
        ['Voce', 'Quantità', 'Importo'],
        ['Fatture Ricevute', str(len(fatture_ric)), format_euro(tot_fatt_ric)],
        ['Fatture Emesse', str(len(fatture_em)), format_euro(tot_fatt_em)],
        ['Corrispettivi', str(len(corrispettivi)), format_euro(tot_corr)],
        ['Prima Nota - Entrate', str(len([m for m in prima_nota if m.get('tipo') == 'entrata'])), format_euro(entrate)],
        ['Prima Nota - Uscite', str(len([m for m in prima_nota if m.get('tipo') == 'uscita'])), format_euro(uscite)],
    ]
    
    table = Table(riepilogo_data, colWidths=[7*cm, 3*cm, 4*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 30))
    
    # Sezione 2: IVA
    elements.append(Paragraph("💰 LIQUIDAZIONE IVA", section_style))
    
    iva_data = [
        ['', 'Importo'],
        ['IVA a Debito (vendite)', format_euro(tot_iva_em)],
        ['IVA a Credito (acquisti)', format_euro(tot_iva_ric)],
        ['Saldo IVA', format_euro(tot_iva_em - tot_iva_ric)],
    ]
    
    table_iva = Table(iva_data, colWidths=[10*cm, 4*cm])
    table_iva.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ef4444')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fef2f2')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    elements.append(table_iva)
    elements.append(Spacer(1, 30))
    
    # Footer
    footer_style = ParagraphStyle('Footer', fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph(f"Report generato automaticamente - {datetime.now().strftime('%d/%m/%Y %H:%M')}", footer_style))
    elements.append(Paragraph("Azienda in Cloud ERP", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=report_commercialista_{mese_nome.lower()}_{anno}.pdf'}
    )
