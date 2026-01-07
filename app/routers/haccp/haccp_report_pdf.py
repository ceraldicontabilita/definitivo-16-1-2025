"""
HACCP Report PDF Router - Generazione report PDF per ispezioni.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
import logging

from app.database import Database

logger = logging.getLogger(__name__)
router = APIRouter()

# Collections
COLLECTION_TEMP_FRIGO = "haccp_temperature_frigoriferi"
COLLECTION_TEMP_CONGEL = "haccp_temperature_congelatori"
COLLECTION_SANIFICAZIONI = "haccp_sanificazioni"
COLLECTION_SCADENZARIO = "haccp_scadenzario"

AZIENDA_INFO = {
    "ragione_sociale": "Ceraldi Group SRL",
    "indirizzo": "Piazza Carità 14 - 80134 Napoli (NA)",
    "piva": "04523831214",
    "telefono": "+393937415426",
    "email": "ceraldigroupsrl@gmail.com"
}


@router.get("/temperature-pdf")
async def generate_temperature_pdf(
    mese: str = Query(..., description="Mese in formato YYYY-MM"),
    tipo: str = Query("frigoriferi", description="frigoriferi o congelatori")
) -> StreamingResponse:
    """Genera PDF registro temperature mensile."""
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab non installato. Installa con: pip install reportlab")
    
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    end_date = f"{year}-{int(month)+1:02d}-01" if int(month) < 12 else f"{int(year)+1}-01-01"
    
    collection = COLLECTION_TEMP_FRIGO if tipo == "frigoriferi" else COLLECTION_TEMP_CONGEL
    
    records = await db[collection].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    # Raggruppa per equipaggiamento e data
    data_by_equip = {}
    for r in records:
        equip = r.get("equipaggiamento", "N/D")
        if equip not in data_by_equip:
            data_by_equip[equip] = {}
        data = r.get("data", "")
        data_by_equip[equip][data] = {
            "temp": r.get("temperatura"),
            "ora": r.get("ora", ""),
            "operatore": r.get("operatore", ""),
            "conforme": r.get("conforme", True)
        }
    
    # Genera PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=1*cm, rightMargin=1*cm, topMargin=1*cm, bottomMargin=1*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=1)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=1)
    
    elements = []
    
    # Header
    elements.append(Paragraph(f"REGISTRO TEMPERATURE {tipo.upper()}", title_style))
    elements.append(Paragraph(f"{AZIENDA_INFO['ragione_sociale']} - {AZIENDA_INFO['indirizzo']}", subtitle_style))
    elements.append(Paragraph(f"Mese: {month}/{year}", subtitle_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # Tabella per ogni equipaggiamento
    from calendar import monthrange
    _, num_days = monthrange(int(year), int(month))
    
    for equip, data_dict in data_by_equip.items():
        elements.append(Paragraph(f"<b>{equip}</b>", styles['Heading3']))
        
        # Header tabella
        header = ["Giorno"] + [str(d) for d in range(1, num_days + 1)]
        temp_row = ["Temp °C"]
        ora_row = ["Ora"]
        op_row = ["Operatore"]
        
        for day in range(1, num_days + 1):
            date_str = f"{mese}-{day:02d}"
            if date_str in data_dict:
                temp = data_dict[date_str].get("temp")
                temp_row.append(f"{temp}°" if temp is not None else "-")
                ora_row.append(data_dict[date_str].get("ora", "-")[:5])
                op_row.append(data_dict[date_str].get("operatore", "-")[:3])
            else:
                temp_row.append("-")
                ora_row.append("-")
                op_row.append("-")
        
        table_data = [header, temp_row, ora_row, op_row]
        
        col_widths = [1.5*cm] + [0.7*cm] * num_days
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 0.5*cm))
    
    # Footer
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(f"Generato il {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
    elements.append(Paragraph("Firma responsabile: ___________________", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"haccp_temperature_{tipo}_{mese}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sanificazioni-pdf")
async def generate_sanificazioni_pdf(mese: str = Query(...)) -> StreamingResponse:
    """Genera PDF registro sanificazioni mensile."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab non installato")
    
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    end_date = f"{year}-{int(month)+1:02d}-01" if int(month) < 12 else f"{int(year)+1}-01-01"
    
    records = await db[COLLECTION_SANIFICAZIONI].find(
        {"data": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).sort("data", 1).to_list(1000)
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=1*cm, rightMargin=1*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, alignment=1)
    
    elements = []
    
    # Header
    elements.append(Paragraph("REGISTRO SANIFICAZIONI", title_style))
    elements.append(Paragraph(f"{AZIENDA_INFO['ragione_sociale']}", styles['Normal']))
    elements.append(Paragraph(f"Mese: {month}/{year}", styles['Normal']))
    elements.append(Spacer(1, 0.5*cm))
    
    # Tabella
    header = ["Data", "Ora", "Area", "Operatore", "Prodotto", "Esito"]
    table_data = [header]
    
    for r in records:
        table_data.append([
            r.get("data", "")[-5:].replace("-", "/"),
            r.get("ora", "")[:5],
            r.get("area", "")[:15],
            r.get("operatore", "")[:10],
            r.get("prodotto_utilizzato", "")[:20],
            r.get("esito", "OK")
        ])
    
    if len(table_data) == 1:
        table_data.append(["Nessuna registrazione", "", "", "", "", ""])
    
    table = Table(table_data, colWidths=[2*cm, 1.5*cm, 3.5*cm, 2.5*cm, 5*cm, 1.5*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(f"Generato il {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
    elements.append(Paragraph("Firma responsabile: ___________________", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=haccp_sanificazioni_{mese}.pdf"}
    )


@router.get("/completo-pdf")
async def generate_report_completo(mese: str = Query(...)) -> StreamingResponse:
    """Genera PDF report HACCP completo per ispezioni ASL."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab non installato")
    
    db = Database.get_db()
    
    year, month = mese.split("-")
    start_date = f"{mese}-01"
    end_date = f"{year}-{int(month)+1:02d}-01" if int(month) < 12 else f"{int(year)+1}-01-01"
    
    # Raccogli tutti i dati
    temp_frigo = await db[COLLECTION_TEMP_FRIGO].find({"data": {"$gte": start_date, "$lt": end_date}}, {"_id": 0}).to_list(1000)
    temp_congel = await db[COLLECTION_TEMP_CONGEL].find({"data": {"$gte": start_date, "$lt": end_date}}, {"_id": 0}).to_list(1000)
    sanif = await db[COLLECTION_SANIFICAZIONI].find({"data": {"$gte": start_date, "$lt": end_date}}, {"_id": 0}).to_list(1000)
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=1.5*cm, rightMargin=1.5*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=14, spaceBefore=15, spaceAfter=10)
    
    elements = []
    
    # Copertina
    elements.append(Spacer(1, 3*cm))
    elements.append(Paragraph("DOCUMENTAZIONE HACCP", title_style))
    elements.append(Paragraph(f"Mese di riferimento: {month}/{year}", styles['Normal']))
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(f"<b>{AZIENDA_INFO['ragione_sociale']}</b>", styles['Normal']))
    elements.append(Paragraph(f"{AZIENDA_INFO['indirizzo']}", styles['Normal']))
    elements.append(Paragraph(f"P.IVA: {AZIENDA_INFO['piva']}", styles['Normal']))
    elements.append(Spacer(1, 2*cm))
    
    # Riepilogo
    elements.append(Paragraph("RIEPILOGO REGISTRAZIONI", section_style))
    summary_data = [
        ["Tipo", "Registrazioni", "Conformi", "Non Conformi"],
        ["Temperature Frigoriferi", str(len(temp_frigo)), str(sum(1 for t in temp_frigo if t.get("conforme", True))), str(sum(1 for t in temp_frigo if not t.get("conforme", True)))],
        ["Temperature Congelatori", str(len(temp_congel)), str(sum(1 for t in temp_congel if t.get("conforme", True))), str(sum(1 for t in temp_congel if not t.get("conforme", True)))],
        ["Sanificazioni", str(len(sanif)), str(sum(1 for s in sanif if s.get("esito") == "OK")), str(sum(1 for s in sanif if s.get("esito") != "OK"))],
    ]
    
    summary_table = Table(summary_data, colWidths=[6*cm, 3*cm, 3*cm, 3*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4CAF50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    elements.append(summary_table)
    
    elements.append(PageBreak())
    
    # Temperature Frigoriferi
    elements.append(Paragraph("REGISTRO TEMPERATURE FRIGORIFERI", section_style))
    if temp_frigo:
        frigo_data = [["Data", "Ora", "Equipaggiamento", "Temp °C", "Conforme", "Operatore"]]
        for t in temp_frigo[:50]:  # Limita a 50 per pagina
            frigo_data.append([
                t.get("data", "")[-5:].replace("-", "/"),
                t.get("ora", "")[:5],
                t.get("equipaggiamento", "")[:20],
                str(t.get("temperatura", "")),
                "✓" if t.get("conforme", True) else "✗",
                t.get("operatore", "")[:10]
            ])
        frigo_table = Table(frigo_data, colWidths=[2*cm, 1.5*cm, 4*cm, 2*cm, 2*cm, 2.5*cm])
        frigo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightblue),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        elements.append(frigo_table)
    else:
        elements.append(Paragraph("Nessuna registrazione nel periodo", styles['Normal']))
    
    elements.append(PageBreak())
    
    # Sanificazioni
    elements.append(Paragraph("REGISTRO SANIFICAZIONI", section_style))
    if sanif:
        sanif_data = [["Data", "Ora", "Area", "Prodotto", "Esito", "Operatore"]]
        for s in sanif[:50]:
            sanif_data.append([
                s.get("data", "")[-5:].replace("-", "/"),
                s.get("ora", "")[:5],
                s.get("area", "")[:15],
                s.get("prodotto_utilizzato", "")[:20],
                s.get("esito", "OK"),
                s.get("operatore", "")[:10]
            ])
        sanif_table = Table(sanif_data, colWidths=[2*cm, 1.5*cm, 3*cm, 4*cm, 1.5*cm, 2*cm])
        sanif_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgreen),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        elements.append(sanif_table)
    else:
        elements.append(Paragraph("Nessuna registrazione nel periodo", styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 2*cm))
    elements.append(Paragraph(f"Documento generato il {datetime.now().strftime('%d/%m/%Y alle %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("Firma Responsabile HACCP: _______________________", styles['Normal']))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("Data verifica: _______________________", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=haccp_report_completo_{mese}.pdf"}
    )
