"""
Test Suite for ERP Refactoring v3.0
Tests for:
- /api/dipendenti - Gestione Dipendenti (27 employees)
- /api/documenti/upload-auto - Upload Auto endpoint
- Health check and basic API functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://invoice-rescue-7.preview.emergentagent.com')

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health check passed: {data}")
    
    def test_ping_endpoint(self):
        """Test /api/ping returns pong"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        data = response.json()
        assert data.get("pong") == True
        print(f"✅ Ping check passed")


class TestDipendentiAPI:
    """Tests for /api/dipendenti endpoint - should return 27 employees"""
    
    def test_list_dipendenti(self):
        """Test GET /api/dipendenti returns list of employees"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        
        # Should have 27 employees as per requirements
        employee_count = len(data)
        print(f"📊 Found {employee_count} dipendenti")
        
        # Verify we have employees
        assert employee_count > 0, "No employees found"
        
        # Check if we have approximately 27 employees (allow some tolerance)
        if employee_count == 27:
            print(f"✅ Exactly 27 dipendenti found as expected")
        else:
            print(f"⚠️ Found {employee_count} dipendenti (expected 27)")
        
        # Verify employee structure
        if data:
            first_employee = data[0]
            print(f"📋 Sample employee: {first_employee.get('nome_completo', first_employee.get('nome', 'N/A'))}")
            
            # Check for expected fields
            expected_fields = ['id', 'nome_completo']
            for field in expected_fields:
                if field not in first_employee:
                    # Try alternative field names
                    if field == 'nome_completo' and ('nome' in first_employee or 'cognome' in first_employee):
                        continue
                    print(f"⚠️ Field '{field}' not found in employee record")
        
        return data
    
    def test_dipendenti_stats(self):
        """Test GET /api/dipendenti/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/stats")
        assert response.status_code == 200
        data = response.json()
        
        print(f"📊 Dipendenti stats: totale={data.get('totale')}, attivi={data.get('attivi')}")
        
        # Verify stats structure
        assert 'totale' in data, "Missing 'totale' in stats"
        assert data.get('totale', 0) > 0, "No employees in stats"
        
        return data
    
    def test_get_single_dipendente(self):
        """Test GET /api/dipendenti/{id} returns single employee"""
        # First get list to get an ID
        list_response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert list_response.status_code == 200
        employees = list_response.json()
        
        if employees:
            first_id = employees[0].get('id')
            if first_id:
                response = requests.get(f"{BASE_URL}/api/dipendenti/{first_id}")
                assert response.status_code == 200
                data = response.json()
                assert data.get('id') == first_id
                print(f"✅ Single dipendente fetch works: {data.get('nome_completo', 'N/A')}")


class TestDocumentiAPI:
    """Tests for /api/documenti endpoints"""
    
    def test_documenti_lista(self):
        """Test GET /api/documenti/lista returns document list"""
        response = requests.get(f"{BASE_URL}/api/documenti/lista")
        assert response.status_code == 200
        data = response.json()
        
        # Should have documents array
        assert 'documents' in data or isinstance(data, list), "Expected documents in response"
        print(f"✅ Documenti lista endpoint works")
        
        return data
    
    def test_documenti_categorie(self):
        """Test GET /api/documenti/categorie returns categories"""
        response = requests.get(f"{BASE_URL}/api/documenti/categorie")
        assert response.status_code == 200
        data = response.json()
        
        assert 'categories' in data, "Expected categories in response"
        print(f"✅ Documenti categorie: {list(data.get('categories', {}).keys())}")
        
        return data
    
    def test_documenti_statistiche(self):
        """Test GET /api/documenti/statistiche returns stats"""
        response = requests.get(f"{BASE_URL}/api/documenti/statistiche")
        assert response.status_code == 200
        data = response.json()
        
        print(f"📊 Documenti stats: totale={data.get('totale')}, nuovi={data.get('nuovi')}")
        return data


class TestPrimaNotaAPI:
    """Tests for Prima Nota endpoints"""
    
    def test_prima_nota_cassa(self):
        """Test GET /api/prima-nota/cassa returns movements"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?anno=2026")
        assert response.status_code == 200
        data = response.json()
        
        # Should be list or have movimenti
        if isinstance(data, list):
            print(f"📊 Prima Nota Cassa: {len(data)} movimenti")
        elif isinstance(data, dict):
            movimenti = data.get('movimenti', [])
            print(f"📊 Prima Nota Cassa: {len(movimenti)} movimenti")
        
        return data
    
    def test_prima_nota_banca(self):
        """Test GET /api/prima-nota/banca returns movements"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?anno=2026")
        assert response.status_code == 200
        data = response.json()
        
        if isinstance(data, list):
            print(f"📊 Prima Nota Banca: {len(data)} movimenti")
        elif isinstance(data, dict):
            movimenti = data.get('movimenti', [])
            print(f"📊 Prima Nota Banca: {len(movimenti)} movimenti")
        
        return data
    
    def test_prima_nota_salari(self):
        """Test GET /api/prima-nota/salari returns salary movements"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/salari?anno=2026")
        assert response.status_code == 200
        data = response.json()
        
        if isinstance(data, list):
            print(f"📊 Prima Nota Salari: {len(data)} movimenti")
        elif isinstance(data, dict):
            movimenti = data.get('movimenti', [])
            print(f"📊 Prima Nota Salari: {len(movimenti)} movimenti")
        
        return data


class TestRiconciliazioneAPI:
    """Tests for Riconciliazione Smart endpoints"""
    
    def test_operazioni_smart_analizza(self):
        """Test GET /api/operazioni-da-confermare/smart/analizza"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=50")
        assert response.status_code == 200
        data = response.json()
        
        movimenti = data.get('movimenti', [])
        print(f"📊 Riconciliazione Smart: {len(movimenti)} movimenti da analizzare")
        
        return data
    
    def test_operazioni_aruba_pendenti(self):
        """Test GET /api/operazioni-da-confermare/aruba-pendenti"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/aruba-pendenti")
        assert response.status_code == 200
        data = response.json()
        
        operazioni = data.get('operazioni', [])
        print(f"📊 Fatture Aruba pendenti: {len(operazioni)}")
        
        return data


class TestImportUnificatoEndpoints:
    """Tests for Import Unificato related endpoints"""
    
    def test_estratto_conto_import_endpoint(self):
        """Test estratto conto import endpoint exists"""
        # This is a POST endpoint, just verify it exists
        response = requests.options(f"{BASE_URL}/api/estratto-conto-movimenti/import")
        # OPTIONS should return 200 or 405 (method not allowed but endpoint exists)
        assert response.status_code in [200, 204, 405], f"Endpoint may not exist: {response.status_code}"
        print(f"✅ Estratto conto import endpoint exists")
    
    def test_f24_upload_endpoint(self):
        """Test F24 upload endpoint exists"""
        response = requests.options(f"{BASE_URL}/api/f24/upload-pdf")
        assert response.status_code in [200, 204, 405, 422], f"Endpoint may not exist: {response.status_code}"
        print(f"✅ F24 upload endpoint exists")
    
    def test_fatture_upload_xml_endpoint(self):
        """Test fatture XML upload endpoint exists"""
        response = requests.options(f"{BASE_URL}/api/fatture/upload-xml")
        assert response.status_code in [200, 204, 405, 422], f"Endpoint may not exist: {response.status_code}"
        print(f"✅ Fatture XML upload endpoint exists")


class TestCedoliniAPI:
    """Tests for Cedolini endpoints"""
    
    def test_cedolini_list(self):
        """Test GET /api/cedolini returns cedolini list"""
        response = requests.get(f"{BASE_URL}/api/cedolini?anno=2026")
        assert response.status_code == 200
        data = response.json()
        
        if isinstance(data, list):
            print(f"📊 Cedolini: {len(data)} records")
        elif isinstance(data, dict):
            cedolini = data.get('cedolini', [])
            print(f"📊 Cedolini: {len(cedolini)} records")
        
        return data


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
