#!/usr/bin/env python3
"""
Script per importare i dati Excel nella Prima Nota
Logica contabile:
- CASSA:
  - Corrispettivi -> DARE (entrata) - incassi giornalieri
  - POS -> AVERE (uscita) - i soldi escono dalla cassa per andare in banca
  - Versamenti -> AVERE (uscita) - versamento in banca
  - Fatture pagate contanti -> AVERE (uscita)
  - Finanziamento soci -> DARE (entrata)
  
- BANCA:
  - Versamenti -> DARE (entrata) - arrivano dalla cassa
  - POS accreditati -> DARE (entrata) - accredito POS
  - Fatture pagate bonifico -> AVERE (uscita)
"""

import openpyxl
import requests
import os
from datetime import datetime, timedelta
from io import BytesIO

API_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://finance-hub-428.preview.emergentagent.com')

def excel_date_to_str(excel_date):
    """Convert Excel serial date to YYYY-MM-DD string"""
    if isinstance(excel_date, (int, float)) and excel_date > 0:
        # Excel date serial number (days since 1899-12-30)
        base_date = datetime(1899, 12, 30)
        return (base_date + timedelta(days=int(excel_date))).strftime('%Y-%m-%d')
    elif isinstance(excel_date, datetime):
        return excel_date.strftime('%Y-%m-%d')
    elif isinstance(excel_date, str):
        return excel_date
    return datetime.now().strftime('%Y-%m-%d')

def download_excel(url):
    """Download Excel file from URL"""
    response = requests.get(url)
    response.raise_for_status()
    return BytesIO(response.content)

def parse_corrispettivi(url):
    """Parse corrispettivi.xlsx - vanno in CASSA come DARE (entrata)"""
    print(f"Parsing corrispettivi from {url}")
    file_content = download_excel(url)
    wb = openpyxl.load_workbook(file_content)
    ws = wb.active
    
    movements = []
    for row in ws.iter_rows(min_row=2, values_only=True):  # Skip header
        if row and len(row) >= 2:
            # The data format seems to be: ID, serial_date, amount1, amount2, ...
            # We need to find the date and total
            data_serial = None
            totale = None
            
            # Try to find date (serial number around 45658+)
            for val in row:
                if isinstance(val, (int, float)):
                    if 45000 < val < 47000:  # Likely a date serial
                        data_serial = val
                    elif 0 < val < 10000:  # Likely an amount
                        if totale is None:
                            totale = val
            
            if data_serial and totale and totale > 0:
                movements.append({
                    "data": excel_date_to_str(data_serial),
                    "tipo": "entrata",  # DARE
                    "importo": round(float(totale), 2),
                    "descrizione": f"Corrispettivo giornaliero",
                    "categoria": "Corrispettivi",
                    "source": "excel_corrispettivi"
                })
    
    print(f"  Found {len(movements)} corrispettivi")
    return movements

def parse_pos(url):
    """Parse pos.xlsx - vanno in CASSA come AVERE (uscita) perché escono dalla cassa"""
    print(f"Parsing POS from {url}")
    file_content = download_excel(url)
    wb = openpyxl.load_workbook(file_content)
    ws = wb.active
    
    cassa_movements = []  # AVERE (uscita da cassa)
    banca_movements = []  # DARE (entrata in banca quando accreditato)
    
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row and len(row) >= 2:
            data_serial = None
            importo = None
            
            for val in row:
                if isinstance(val, (int, float)):
                    if 45000 < val < 47000:
                        data_serial = val
                    elif 0 < val < 50000:
                        if importo is None:
                            importo = val
            
            if data_serial and importo and importo > 0:
                data_str = excel_date_to_str(data_serial)
                
                # POS in CASSA come AVERE (i soldi escono per andare in banca)
                cassa_movements.append({
                    "data": data_str,
                    "tipo": "uscita",  # AVERE - escono dalla cassa
                    "importo": round(float(importo), 2),
                    "descrizione": f"POS giornaliero - accredito banca",
                    "categoria": "POS",
                    "source": "excel_pos"
                })
                
                # POS in BANCA come DARE (i soldi entrano quando accreditati)
                banca_movements.append({
                    "data": data_str,
                    "tipo": "entrata",  # DARE - entrano in banca
                    "importo": round(float(importo), 2),
                    "descrizione": f"Accredito POS giornaliero",
                    "categoria": "POS",
                    "source": "excel_pos"
                })
    
    print(f"  Found {len(cassa_movements)} POS movements")
    return cassa_movements, banca_movements

def parse_versamenti(url):
    """Parse versamento.xlsx - CASSA AVERE (uscita), BANCA DARE (entrata)"""
    print(f"Parsing versamenti from {url}")
    file_content = download_excel(url)
    wb = openpyxl.load_workbook(file_content)
    ws = wb.active
    
    cassa_movements = []  # AVERE (uscita da cassa)
    banca_movements = []  # DARE (entrata in banca)
    
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row and len(row) >= 2:
            data_serial = None
            importo = None
            
            for val in row:
                if isinstance(val, (int, float)):
                    if 45000 < val < 47000:
                        data_serial = val
                    elif 100 < val < 50000:  # Importi versamento più grandi
                        if importo is None:
                            importo = val
            
            if data_serial and importo and importo > 0:
                data_str = excel_date_to_str(data_serial)
                
                # Versamento USCITA da CASSA
                cassa_movements.append({
                    "data": data_str,
                    "tipo": "uscita",  # AVERE
                    "importo": round(float(importo), 2),
                    "descrizione": f"Versamento in banca",
                    "categoria": "Versamento",
                    "source": "excel_versamento"
                })
                
                # Versamento ENTRATA in BANCA
                banca_movements.append({
                    "data": data_str,
                    "tipo": "entrata",  # DARE
                    "importo": round(float(importo), 2),
                    "descrizione": f"Versamento da cassa",
                    "categoria": "Versamento",
                    "source": "excel_versamento"
                })
    
    print(f"  Found {len(cassa_movements)} versamenti")
    return cassa_movements, banca_movements

def parse_finanziamento_soci(url):
    """Parse finanziamento soci.xlsx - vanno in CASSA come DARE (entrata)"""
    print(f"Parsing finanziamento soci from {url}")
    file_content = download_excel(url)
    wb = openpyxl.load_workbook(file_content)
    ws = wb.active
    
    movements = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row and len(row) >= 2:
            data_serial = None
            importo = None
            descrizione = "Finanziamento soci"
            
            for val in row:
                if isinstance(val, (int, float)):
                    if 45000 < val < 47000:
                        data_serial = val
                    elif 100 < val < 100000:
                        if importo is None:
                            importo = val
                elif isinstance(val, str) and "ceraldi" in val.lower():
                    descrizione = f"Finanziamento socio - {val}"
            
            if data_serial and importo and importo > 0:
                movements.append({
                    "data": excel_date_to_str(data_serial),
                    "tipo": "entrata",  # DARE - entrano soldi in cassa
                    "importo": round(float(importo), 2),
                    "descrizione": descrizione,
                    "categoria": "Finanziamento soci",
                    "source": "excel_finanziamento"
                })
    
    print(f"  Found {len(movements)} finanziamenti soci")
    return movements

def import_to_api(cassa_movements, banca_movements):
    """Import movements to Prima Nota API"""
    payload = {
        "cassa": cassa_movements,
        "banca": banca_movements
    }
    
    response = requests.post(
        f"{API_URL}/api/prima-nota/import-batch",
        json=payload
    )
    
    return response.json()

def main():
    # URLs dei file Excel
    corrispettivi_url = "https://customer-assets.emergentagent.com/job_d33da9de-0c8a-4ce3-90d6-dbb93f270aa0/artifacts/x9v56oeo_corrispettivi.xlsx"
    pos_url = "https://customer-assets.emergentagent.com/job_d33da9de-0c8a-4ce3-90d6-dbb93f270aa0/artifacts/1hu7vd4q_pos.xlsx"
    versamento_url = "https://customer-assets.emergentagent.com/job_d33da9de-0c8a-4ce3-90d6-dbb93f270aa0/artifacts/cegmb0pu_versamento.xlsx"
    finanziamento_url = "https://customer-assets.emergentagent.com/job_d33da9de-0c8a-4ce3-90d6-dbb93f270aa0/artifacts/jk25dlqh_finanziamento%20soci.xlsx"
    
    # Raccolta movimenti
    all_cassa = []
    all_banca = []
    
    # 1. Corrispettivi -> CASSA DARE (entrata)
    corrisp = parse_corrispettivi(corrispettivi_url)
    all_cassa.extend(corrisp)
    
    # 2. POS -> CASSA AVERE (uscita), BANCA DARE (entrata)
    pos_cassa, pos_banca = parse_pos(pos_url)
    all_cassa.extend(pos_cassa)
    all_banca.extend(pos_banca)
    
    # 3. Versamenti -> CASSA AVERE (uscita), BANCA DARE (entrata)
    vers_cassa, vers_banca = parse_versamenti(versamento_url)
    all_cassa.extend(vers_cassa)
    all_banca.extend(vers_banca)
    
    # 4. Finanziamento soci -> CASSA DARE (entrata)
    fin = parse_finanziamento_soci(finanziamento_url)
    all_cassa.extend(fin)
    
    print(f"\nTotale movimenti CASSA: {len(all_cassa)}")
    print(f"Totale movimenti BANCA: {len(all_banca)}")
    
    # Import via API
    print("\nImportazione in corso...")
    result = import_to_api(all_cassa, all_banca)
    print(f"Risultato: {result}")

if __name__ == "__main__":
    main()
