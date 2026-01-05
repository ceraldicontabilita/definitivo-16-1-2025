"""
Test Suite for Scadenze (Deadlines/Notifications) and Bilancio PDF Export Features
Tests the new ERP features:
1. GET /api/scadenze/prossime - Upcoming deadlines
2. GET /api/scadenze/iva/{anno} - IVA quarterly deadlines
3. GET /api/scadenze/tutte - All deadlines (fiscal + invoices)
4. POST /api/scadenze/crea - Create custom deadline
5. GET /api/bilancio/export/pdf/confronto - Comparative balance PDF export
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestScadenzeProssime:
    """Tests for GET /api/scadenze/prossime endpoint - Upcoming deadlines widget"""
    
    def test_get_prossime_scadenze_default(self):
        """Test getting upcoming deadlines with default 30 days"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime")
        assert response.status_code == 200
        
        data = response.json()
        assert "scadenze" in data
        assert "totale" in data
        assert "prossima_scadenza" in data
        assert isinstance(data["scadenze"], list)
        
    def test_get_prossime_scadenze_with_giorni(self):
        """Test getting upcoming deadlines with custom days parameter"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime?giorni=60")
        assert response.status_code == 200
        
        data = response.json()
        assert "scadenze" in data
        assert isinstance(data["scadenze"], list)
        
    def test_get_prossime_scadenze_with_limit(self):
        """Test getting upcoming deadlines with limit"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime?giorni=30&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["scadenze"]) <= 5
        
    def test_scadenze_structure(self):
        """Test that each scadenza has required fields"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime?giorni=60&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if data["scadenze"]:
            scadenza = data["scadenze"][0]
            assert "data" in scadenza
            assert "tipo" in scadenza
            assert "descrizione" in scadenza
            assert "giorni_mancanti" in scadenza
            assert "urgente" in scadenza


class TestScadenzeIVA:
    """Tests for GET /api/scadenze/iva/{anno} endpoint - IVA quarterly deadlines"""
    
    def test_get_scadenze_iva_2025(self):
        """Test getting IVA deadlines for 2025"""
        response = requests.get(f"{BASE_URL}/api/scadenze/iva/2025")
        assert response.status_code == 200
        
        data = response.json()
        assert data["anno"] == 2025
        assert "scadenze" in data
        assert len(data["scadenze"]) == 4  # 4 quarters
        assert "totale_da_versare" in data
        assert "prossima_scadenza" in data
        
    def test_iva_quarters_structure(self):
        """Test that each IVA quarter has required fields"""
        response = requests.get(f"{BASE_URL}/api/scadenze/iva/2025")
        assert response.status_code == 200
        
        data = response.json()
        for scadenza in data["scadenze"]:
            assert "trimestre" in scadenza
            assert "periodo" in scadenza
            assert "data_scadenza" in scadenza
            assert "iva_debito" in scadenza
            assert "iva_credito" in scadenza
            assert "saldo" in scadenza
            assert "da_versare" in scadenza
            assert "importo_versamento" in scadenza
            assert "stato" in scadenza
            
    def test_iva_calculation_logic(self):
        """Test IVA calculation logic - saldo = debito - credito"""
        response = requests.get(f"{BASE_URL}/api/scadenze/iva/2025")
        assert response.status_code == 200
        
        data = response.json()
        for scadenza in data["scadenze"]:
            expected_saldo = round(scadenza["iva_debito"] - scadenza["iva_credito"], 2)
            assert abs(scadenza["saldo"] - expected_saldo) < 0.01
            
            # da_versare should be True if saldo > 0
            if scadenza["saldo"] > 0:
                assert scadenza["da_versare"] == True
                assert scadenza["importo_versamento"] > 0
            else:
                assert scadenza["da_versare"] == False
                assert scadenza["importo_versamento"] == 0


class TestScadenzeTutte:
    """Tests for GET /api/scadenze/tutte endpoint - All deadlines"""
    
    def test_get_tutte_scadenze(self):
        """Test getting all deadlines"""
        response = requests.get(f"{BASE_URL}/api/scadenze/tutte?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert "scadenze" in data
        assert "totale" in data
        assert "statistiche" in data
        
    def test_filter_by_tipo(self):
        """Test filtering deadlines by type"""
        for tipo in ["IVA", "F24", "FATTURA"]:
            response = requests.get(f"{BASE_URL}/api/scadenze/tutte?anno=2025&tipo={tipo}")
            assert response.status_code == 200
            
            data = response.json()
            for scadenza in data["scadenze"]:
                assert scadenza["tipo"] == tipo
                
    def test_include_passate(self):
        """Test including past deadlines"""
        response = requests.get(f"{BASE_URL}/api/scadenze/tutte?anno=2025&include_passate=true")
        assert response.status_code == 200
        
        data = response.json()
        assert "scadenze" in data
        
    def test_statistiche_structure(self):
        """Test statistics structure in response"""
        response = requests.get(f"{BASE_URL}/api/scadenze/tutte?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        stats = data["statistiche"]
        assert "urgenti" in stats
        assert "prossimi_7_giorni" in stats
        assert "totale_importo" in stats


class TestScadenzeCrea:
    """Tests for POST /api/scadenze/crea endpoint - Create custom deadline"""
    
    def test_create_scadenza_success(self):
        """Test creating a new custom deadline"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "data_scadenza": "2026-03-15",
            "descrizione": f"TEST_Scadenza_{unique_id}",
            "tipo": "CUSTOM",
            "importo": 1500.50,
            "priorita": "alta",
            "note": "Test note"
        }
        
        response = requests.post(f"{BASE_URL}/api/scadenze/crea", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "notifica" in data
        
        notifica = data["notifica"]
        assert notifica["data_scadenza"] == payload["data_scadenza"]
        assert notifica["descrizione"] == payload["descrizione"]
        assert notifica["tipo"] == payload["tipo"]
        assert notifica["importo"] == payload["importo"]
        assert notifica["priorita"] == payload["priorita"]
        assert notifica["completata"] == False
        assert "id" in notifica
        
        # Cleanup - delete the test scadenza
        requests.delete(f"{BASE_URL}/api/scadenze/{notifica['id']}")
        
    def test_create_scadenza_minimal(self):
        """Test creating deadline with minimal required fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "data_scadenza": "2026-04-01",
            "descrizione": f"TEST_Minimal_{unique_id}",
            "tipo": "CUSTOM"
        }
        
        response = requests.post(f"{BASE_URL}/api/scadenze/crea", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/scadenze/{data['notifica']['id']}")
        
    def test_create_scadenza_missing_data(self):
        """Test creating deadline without required data_scadenza"""
        payload = {
            "descrizione": "Test without date"
        }
        
        response = requests.post(f"{BASE_URL}/api/scadenze/crea", json=payload)
        assert response.status_code == 400
        
    def test_create_scadenza_missing_descrizione(self):
        """Test creating deadline without required descrizione"""
        payload = {
            "data_scadenza": "2026-05-01"
        }
        
        response = requests.post(f"{BASE_URL}/api/scadenze/crea", json=payload)
        assert response.status_code == 400


class TestScadenzeCompletaElimina:
    """Tests for PUT /api/scadenze/completa and DELETE /api/scadenze endpoints"""
    
    def test_completa_and_delete_scadenza(self):
        """Test completing and deleting a custom deadline"""
        # Create a test scadenza
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "data_scadenza": "2026-06-01",
            "descrizione": f"TEST_Complete_{unique_id}",
            "tipo": "CUSTOM"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/scadenze/crea", json=payload)
        assert create_response.status_code == 200
        notifica_id = create_response.json()["notifica"]["id"]
        
        # Complete the scadenza
        complete_response = requests.put(f"{BASE_URL}/api/scadenze/completa/{notifica_id}")
        assert complete_response.status_code == 200
        assert complete_response.json()["success"] == True
        
        # Delete the scadenza
        delete_response = requests.delete(f"{BASE_URL}/api/scadenze/{notifica_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
    def test_completa_nonexistent(self):
        """Test completing a non-existent deadline"""
        response = requests.put(f"{BASE_URL}/api/scadenze/completa/nonexistent-id-12345")
        assert response.status_code == 404
        
    def test_delete_nonexistent(self):
        """Test deleting a non-existent deadline"""
        response = requests.delete(f"{BASE_URL}/api/scadenze/nonexistent-id-12345")
        assert response.status_code == 404


class TestBilancioExportPDFConfronto:
    """Tests for GET /api/bilancio/export/pdf/confronto endpoint - Comparative PDF export"""
    
    def test_export_confronto_pdf_success(self):
        """Test exporting comparative balance PDF"""
        response = requests.get(f"{BASE_URL}/api/bilancio/export/pdf/confronto?anno_corrente=2025")
        assert response.status_code == 200
        
        # Check content type is PDF
        assert "application/pdf" in response.headers.get("content-type", "")
        
        # Check content disposition header
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp
        assert "confronto" in content_disp.lower()
        
        # Check PDF content starts with PDF magic bytes
        assert response.content[:4] == b'%PDF'
        
    def test_export_confronto_pdf_with_anno_precedente(self):
        """Test exporting comparative PDF with explicit previous year"""
        response = requests.get(f"{BASE_URL}/api/bilancio/export/pdf/confronto?anno_corrente=2025&anno_precedente=2024")
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_export_confronto_pdf_missing_anno(self):
        """Test export without required anno_corrente parameter"""
        response = requests.get(f"{BASE_URL}/api/bilancio/export/pdf/confronto")
        # Should return 422 (validation error) for missing required parameter
        assert response.status_code == 422


class TestBilancioConfrontoAnnuale:
    """Tests for GET /api/bilancio/confronto-annuale endpoint - Year comparison data"""
    
    def test_confronto_annuale_success(self):
        """Test getting annual comparison data"""
        response = requests.get(f"{BASE_URL}/api/bilancio/confronto-annuale?anno_corrente=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert data["anno_corrente"] == 2025
        assert data["anno_precedente"] == 2024
        assert "conto_economico" in data
        assert "stato_patrimoniale" in data
        assert "kpi" in data
        assert "sintesi" in data
        
    def test_confronto_annuale_structure(self):
        """Test structure of annual comparison response"""
        response = requests.get(f"{BASE_URL}/api/bilancio/confronto-annuale?anno_corrente=2025")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check conto_economico structure
        ce = data["conto_economico"]
        assert "ricavi" in ce
        assert "costi" in ce
        assert "risultato" in ce
        
        # Check stato_patrimoniale structure
        sp = data["stato_patrimoniale"]
        assert "attivo" in sp
        assert "passivo" in sp
        
        # Check KPI structure
        kpi = data["kpi"]
        assert "margine_lordo_pct" in kpi
        assert "roi_pct" in kpi
        
        # Check sintesi structure
        sintesi = data["sintesi"]
        assert "ricavi_trend" in sintesi
        assert "utile_trend" in sintesi
        assert "liquidita_trend" in sintesi


class TestDashboardScadenzeWidget:
    """Tests for Dashboard scadenze widget integration"""
    
    def test_dashboard_scadenze_data(self):
        """Test that dashboard can get scadenze data for widget"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime?giorni=30&limit=8")
        assert response.status_code == 200
        
        data = response.json()
        assert "scadenze" in data
        assert "totale" in data
        assert "prossima_scadenza" in data
        
        # Widget should show urgency info
        if data["scadenze"]:
            for s in data["scadenze"]:
                assert "urgente" in s
                assert "giorni_mancanti" in s


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
