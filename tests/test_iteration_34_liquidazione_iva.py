# -*- coding: utf-8 -*-
"""
Test Suite for Liquidazione IVA Module - Iteration 34
Tests for VAT liquidation calculation, comparison with accountant, annual summary, and PDF export.

Features tested:
- GET /api/liquidazione-iva/calcola/{anno}/{mese} - Monthly VAT liquidation calculation
- GET /api/liquidazione-iva/confronto/{anno}/{mese} - Comparison with accountant values
- GET /api/liquidazione-iva/riepilogo-annuale/{anno} - Annual summary
- GET /api/liquidazione-iva/export/pdf/{anno}/{mese} - PDF export
- GET /api/liquidazione-iva/dettaglio-fatture/{anno}/{mese} - Invoice details
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLiquidazioneIVACalcolo:
    """Tests for VAT liquidation calculation endpoint"""
    
    def test_calcola_liquidazione_gennaio_2026(self):
        """Test VAT liquidation calculation for January 2026"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/1")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "anno" in data
        assert "mese" in data
        assert "mese_nome" in data
        assert "periodo" in data
        assert "iva_debito" in data
        assert "iva_credito" in data
        assert "credito_precedente" in data
        assert "iva_da_versare" in data
        assert "credito_da_riportare" in data
        assert "stato" in data
        assert "sales_detail" in data
        assert "purchase_detail" in data
        assert "statistiche" in data
        
        # Verify data types
        assert data["anno"] == 2026
        assert data["mese"] == 1
        assert data["mese_nome"] == "Gennaio"
        assert isinstance(data["iva_debito"], (int, float))
        assert isinstance(data["iva_credito"], (int, float))
        
        # Verify statistics structure
        stats = data["statistiche"]
        assert "fatture_incluse" in stats
        assert "fatture_escluse" in stats
        assert "note_credito" in stats
        assert "corrispettivi_count" in stats
        
        print(f"✅ Liquidazione Gennaio 2026: IVA Debito={data['iva_debito']}, IVA Credito={data['iva_credito']}, Stato={data['stato']}")
    
    def test_calcola_liquidazione_con_credito_precedente(self):
        """Test VAT liquidation with previous credit carry-over"""
        credito_precedente = 1000.0
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/calcola/2026/1",
            params={"credito_precedente": credito_precedente}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["credito_precedente"] == credito_precedente
        
        print(f"✅ Liquidazione con credito precedente: {credito_precedente}€")
    
    def test_calcola_liquidazione_mese_invalido(self):
        """Test VAT liquidation with invalid month"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/13")
        
        assert response.status_code == 400
        print("✅ Invalid month correctly rejected")
    
    def test_calcola_liquidazione_anno_invalido(self):
        """Test VAT liquidation with invalid year"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2050/1")
        
        assert response.status_code == 400
        print("✅ Invalid year correctly rejected")
    
    def test_calcola_liquidazione_multiple_months(self):
        """Test VAT liquidation for multiple months"""
        for mese in [1, 2, 3]:
            response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/{mese}")
            assert response.status_code == 200, f"Failed for month {mese}"
            data = response.json()
            assert data["mese"] == mese
        
        print("✅ Multiple months calculation working")


class TestLiquidazioneIVAConfronto:
    """Tests for VAT comparison with accountant endpoint"""
    
    def test_confronto_commercialista(self):
        """Test comparison with accountant values"""
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/confronto/2026/1",
            params={
                "iva_debito_commercialista": 900,
                "iva_credito_commercialista": 16000
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "periodo" in data
        assert "calcolo_interno" in data
        assert "calcolo_commercialista" in data
        assert "differenze" in data
        assert "esito" in data
        
        # Verify calcolo_interno structure
        calcolo_interno = data["calcolo_interno"]
        assert "iva_debito" in calcolo_interno
        assert "iva_credito" in calcolo_interno
        assert "saldo" in calcolo_interno
        
        # Verify calcolo_commercialista structure
        calcolo_comm = data["calcolo_commercialista"]
        assert calcolo_comm["iva_debito"] == 900
        assert calcolo_comm["iva_credito"] == 16000
        
        # Verify differenze structure
        differenze = data["differenze"]
        assert "iva_debito" in differenze
        assert "iva_credito" in differenze
        assert "saldo" in differenze
        
        # Verify esito structure
        esito = data["esito"]
        assert "coincide" in esito
        assert "tolleranza_euro" in esito
        assert "note" in esito
        
        print(f"✅ Confronto commercialista: Differenza debito={differenze['iva_debito']}, Differenza credito={differenze['iva_credito']}")
    
    def test_confronto_valori_coincidenti(self):
        """Test comparison when values match"""
        # First get the actual calculated values
        calc_response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/1")
        calc_data = calc_response.json()
        
        # Use the same values for comparison
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/confronto/2026/1",
            params={
                "iva_debito_commercialista": calc_data["iva_debito"],
                "iva_credito_commercialista": calc_data["iva_credito"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should coincide
        assert data["esito"]["coincide"] == True
        assert "✅" in data["esito"]["note"]
        
        print("✅ Matching values correctly identified as coinciding")
    
    def test_confronto_missing_params(self):
        """Test comparison with missing parameters"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/confronto/2026/1")
        
        # Should fail due to missing required params
        assert response.status_code == 422
        print("✅ Missing parameters correctly rejected")


class TestLiquidazioneIVARiepilogoAnnuale:
    """Tests for annual VAT summary endpoint"""
    
    def test_riepilogo_annuale_2026(self):
        """Test annual summary for 2026"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/riepilogo-annuale/2026")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "anno" in data
        assert "mensile" in data
        assert "totali" in data
        
        assert data["anno"] == 2026
        
        # Verify mensile is a list with 12 months
        mensile = data["mensile"]
        assert isinstance(mensile, list)
        assert len(mensile) == 12
        
        # Verify each month has required fields
        for m in mensile:
            assert "mese" in m
            assert "mese_nome" in m
            if "errore" not in m:
                assert "iva_debito" in m
                assert "iva_credito" in m
                assert "stato" in m
        
        # Verify totali structure
        totali = data["totali"]
        assert "iva_debito_totale" in totali
        assert "iva_credito_totale" in totali
        assert "iva_versata_totale" in totali
        assert "credito_finale" in totali
        assert "saldo_annuale" in totali
        
        print(f"✅ Riepilogo annuale 2026: Debito totale={totali['iva_debito_totale']}, Credito totale={totali['iva_credito_totale']}")
    
    def test_riepilogo_annuale_2025(self):
        """Test annual summary for 2025"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/riepilogo-annuale/2025")
        
        assert response.status_code == 200
        data = response.json()
        assert data["anno"] == 2025
        
        print("✅ Riepilogo annuale 2025 working")


class TestLiquidazioneIVAPDFExport:
    """Tests for PDF export endpoint"""
    
    def test_export_pdf_gennaio_2026(self):
        """Test PDF export for January 2026"""
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/export/pdf/2026/1",
            stream=True
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify content type is PDF
        content_type = response.headers.get('content-type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        # Verify content disposition header
        content_disposition = response.headers.get('content-disposition', '')
        assert 'attachment' in content_disposition
        assert 'Liquidazione_IVA' in content_disposition
        
        # Verify PDF content starts with PDF magic bytes
        content = response.content
        assert content[:4] == b'%PDF', "Content does not start with PDF magic bytes"
        
        # Verify PDF has reasonable size (at least 1KB)
        assert len(content) > 1000, f"PDF too small: {len(content)} bytes"
        
        print(f"✅ PDF export working: {len(content)} bytes, filename in header")
    
    def test_export_pdf_con_credito_precedente(self):
        """Test PDF export with previous credit"""
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/export/pdf/2026/1",
            params={"credito_precedente": 500},
            stream=True
        )
        
        assert response.status_code == 200
        assert 'application/pdf' in response.headers.get('content-type', '')
        
        print("✅ PDF export with credito_precedente working")


class TestLiquidazioneIVADettaglioFatture:
    """Tests for invoice details endpoint"""
    
    def test_dettaglio_fatture_tutte(self):
        """Test invoice details - all invoices"""
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/dettaglio-fatture/2026/1",
            params={"tipo": "tutte"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "incluse" in data
        assert "escluse" in data
        assert "totale" in data
        
        # Verify incluse structure
        incluse = data["incluse"]
        assert "fatture" in incluse
        assert "count" in incluse
        
        # Verify escluse structure
        escluse = data["escluse"]
        assert "fatture" in escluse
        assert "count" in escluse
        
        print(f"✅ Dettaglio fatture: {incluse['count']} incluse, {escluse['count']} escluse")
    
    def test_dettaglio_fatture_incluse(self):
        """Test invoice details - included only"""
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/dettaglio-fatture/2026/1",
            params={"tipo": "incluse"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "fatture" in data
        assert "count" in data
        
        # Verify each invoice has required fields
        if data["count"] > 0:
            fattura = data["fatture"][0]
            assert "invoice_number" in fattura or fattura.get("invoice_number") is None
            assert "criterio_inclusione" in fattura
        
        print(f"✅ Dettaglio fatture incluse: {data['count']} fatture")
    
    def test_dettaglio_fatture_escluse(self):
        """Test invoice details - excluded only"""
        response = requests.get(
            f"{BASE_URL}/api/liquidazione-iva/dettaglio-fatture/2026/1",
            params={"tipo": "escluse"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "fatture" in data
        assert "count" in data
        
        print(f"✅ Dettaglio fatture escluse: {data['count']} fatture")


class TestLiquidazioneIVADataIntegrity:
    """Tests for data integrity and business logic"""
    
    def test_saldo_calculation(self):
        """Test that saldo is correctly calculated"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/1")
        data = response.json()
        
        iva_debito = data["iva_debito"]
        iva_credito = data["iva_credito"]
        credito_precedente = data["credito_precedente"]
        iva_da_versare = data["iva_da_versare"]
        credito_da_riportare = data["credito_da_riportare"]
        
        # Either iva_da_versare or credito_da_riportare should be > 0, not both
        assert not (iva_da_versare > 0 and credito_da_riportare > 0), "Both versare and riportare cannot be positive"
        
        # Verify stato matches the values
        if iva_da_versare > 0:
            assert data["stato"] == "Da versare"
        elif credito_da_riportare > 0:
            assert data["stato"] == "A credito"
        else:
            assert data["stato"] == "Pareggio"
        
        print(f"✅ Saldo calculation correct: stato={data['stato']}")
    
    def test_sales_detail_totals(self):
        """Test that sales detail totals match iva_debito"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/1")
        data = response.json()
        
        sales_detail = data.get("sales_detail", {})
        total_iva_from_detail = sum(v["iva"] for v in sales_detail.values())
        
        # Allow small rounding difference
        assert abs(total_iva_from_detail - data["iva_debito"]) < 0.1, \
            f"Sales detail total {total_iva_from_detail} doesn't match iva_debito {data['iva_debito']}"
        
        print(f"✅ Sales detail totals match: {total_iva_from_detail} ≈ {data['iva_debito']}")
    
    def test_purchase_detail_totals(self):
        """Test that purchase detail totals match iva_credito"""
        response = requests.get(f"{BASE_URL}/api/liquidazione-iva/calcola/2026/1")
        data = response.json()
        
        purchase_detail = data.get("purchase_detail", {})
        total_iva_from_detail = sum(v["iva"] for v in purchase_detail.values())
        
        # Allow small rounding difference
        assert abs(total_iva_from_detail - data["iva_credito"]) < 0.1, \
            f"Purchase detail total {total_iva_from_detail} doesn't match iva_credito {data['iva_credito']}"
        
        print(f"✅ Purchase detail totals match: {total_iva_from_detail} ≈ {data['iva_credito']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
