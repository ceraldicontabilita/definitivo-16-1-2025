"""
Import Templates Router
Fornisce template Excel scaricabili per ogni tipo di importazione
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

router = APIRouter()

def create_styled_workbook():
    """Crea un workbook con stili predefiniti."""
    wb = openpyxl.Workbook()
    return wb

def style_header_row(ws, headers, descriptions=None):
    """Applica stile alle intestazioni."""
    header_fill = PatternFill(start_color="1e3a5f", end_color="1e3a5f", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    desc_fill = PatternFill(start_color="e8f4f8", end_color="e8f4f8", fill_type="solid")
    desc_font = Font(color="666666", italic=True, size=9)
    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Intestazioni
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = border
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = max(15, len(header) + 5)
    
    # Descrizioni (riga 2)
    if descriptions:
        for col, desc in enumerate(descriptions, 1):
            cell = ws.cell(row=2, column=col, value=desc)
            cell.fill = desc_fill
            cell.font = desc_font
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = border
        ws.row_dimensions[2].height = 30

def add_example_row(ws, example_data, start_row=3):
    """Aggiunge una riga di esempio."""
    example_font = Font(color="999999", italic=True)
    for col, value in enumerate(example_data, 1):
        cell = ws.cell(row=start_row, column=col, value=value)
        cell.font = example_font


@router.get("/versamenti")
async def template_versamenti():
    """Template per importazione versamenti in banca."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Versamenti"
    
    headers = ["data", "importo", "descrizione"]
    descriptions = [
        "Formato: YYYY-MM-DD o DD/MM/YYYY",
        "Importo del versamento (€)",
        "Descrizione opzionale"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["2025-01-15", 5000.00, "Versamento contanti cassa"])
    add_example_row(ws, ["2025-01-20", 3500.50, "Versamento POS"], start_row=4)
    
    # Info sheet
    info_ws = wb.create_sheet("INFO")
    info_ws["A1"] = "ISTRUZIONI IMPORTAZIONE VERSAMENTI"
    info_ws["A1"].font = Font(bold=True, size=14)
    info_ws["A3"] = "1. Compilare le colonne data, importo e descrizione"
    info_ws["A4"] = "2. La data deve essere nel formato YYYY-MM-DD o DD/MM/YYYY"
    info_ws["A5"] = "3. L'importo deve essere un numero (usare . o , come separatore decimale)"
    info_ws["A6"] = "4. La descrizione è opzionale"
    info_ws["A8"] = "NOTA: Le righe con intestazioni o esempi verranno ignorate automaticamente"
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_versamenti.xlsx"}
    )


@router.get("/pos")
async def template_pos():
    """Template per importazione incassi POS."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Incassi POS"
    
    headers = ["data", "POS1", "POS2", "POS3", "totale"]
    descriptions = [
        "Formato: YYYY-MM-DD",
        "Importo POS 1 (€)",
        "Importo POS 2 (€)",
        "Importo POS 3 (€)",
        "Totale giornaliero (€)"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["2025-01-15", 1500.00, 800.50, 450.25, 2750.75])
    add_example_row(ws, ["2025-01-16", 2000.00, 950.00, 600.00, 3550.00], start_row=4)
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_pos.xlsx"}
    )


@router.get("/corrispettivi")
async def template_corrispettivi():
    """Template per importazione corrispettivi giornalieri."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Corrispettivi"
    
    headers = ["data", "totale", "pagato_contanti", "pagato_elettronico", "imponibile", "iva"]
    descriptions = [
        "Formato: YYYY-MM-DD",
        "Totale corrispettivo (€)",
        "Pagato in contanti (€)",
        "Pagato elettronico (€)",
        "Imponibile (€)",
        "IVA (€)"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["2025-01-15", 4187.42, 1911.92, 2275.50, 3432.31, 755.11])
    add_example_row(ws, ["2025-01-16", 3850.00, 1500.00, 2350.00, 3155.74, 694.26], start_row=4)
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_corrispettivi.xlsx"}
    )


@router.get("/estratto-conto")
async def template_estratto_conto():
    """Template per importazione estratto conto bancario."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Estratto Conto"
    
    headers = ["data_operazione", "data_valuta", "descrizione", "dare", "avere", "saldo"]
    descriptions = [
        "Data operazione",
        "Data valuta",
        "Descrizione movimento",
        "Importo uscita (€)",
        "Importo entrata (€)",
        "Saldo progressivo (€)"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["2025-01-15", "2025-01-15", "PAGAMENTO BONIFICO FORNITORE XYZ", 1500.00, "", 10000.00])
    add_example_row(ws, ["2025-01-16", "2025-01-16", "VERSAMENTO CONTANTI", "", 3000.00, 13000.00], start_row=4)
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_estratto_conto.xlsx"}
    )


@router.get("/fornitori")
async def template_fornitori():
    """Template per importazione anagrafica fornitori."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Fornitori"
    
    headers = ["ragione_sociale", "partita_iva", "codice_fiscale", "indirizzo", "citta", "cap", "email", "telefono", "metodo_pagamento"]
    descriptions = [
        "Nome azienda *",
        "P.IVA (11 cifre) *",
        "Codice Fiscale",
        "Indirizzo",
        "Città",
        "CAP",
        "Email",
        "Telefono",
        "bonifico/cassa/carta"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["ACME SRL", "12345678901", "12345678901", "Via Roma 1", "Milano", "20100", "info@acme.it", "02123456", "bonifico"])
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_fornitori.xlsx"}
    )


@router.get("/prodotti")
async def template_prodotti():
    """Template per importazione prodotti magazzino."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Prodotti"
    
    headers = ["nome", "codice", "categoria", "unita_misura", "prezzo_acquisto", "prezzo_vendita", "giacenza", "scorta_minima"]
    descriptions = [
        "Nome prodotto *",
        "Codice/SKU",
        "Categoria",
        "pz/kg/lt/cf",
        "Prezzo acquisto (€)",
        "Prezzo vendita (€)",
        "Quantità attuale",
        "Quantità minima alert"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["Farina 00 kg 25", "FAR001", "Materie Prime", "kg", 18.50, 0, 100, 20])
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_prodotti.xlsx"}
    )


@router.get("/dipendenti")
async def template_dipendenti():
    """Template per importazione anagrafica dipendenti."""
    wb = create_styled_workbook()
    ws = wb.active
    ws.title = "Dipendenti"
    
    headers = ["nome", "cognome", "codice_fiscale", "data_nascita", "data_assunzione", "qualifica", "retribuzione_lorda", "email", "telefono"]
    descriptions = [
        "Nome *",
        "Cognome *",
        "Codice Fiscale *",
        "Data nascita",
        "Data assunzione",
        "Qualifica/Mansione",
        "Retribuzione lorda (€)",
        "Email",
        "Telefono"
    ]
    
    style_header_row(ws, headers, descriptions)
    add_example_row(ws, ["Mario", "Rossi", "RSSMRA80A01H501Z", "1980-01-01", "2020-03-15", "Operaio", 1800.00, "mario.rossi@email.it", "3331234567"])
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_dipendenti.xlsx"}
    )
