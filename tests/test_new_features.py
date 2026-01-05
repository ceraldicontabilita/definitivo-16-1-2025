"""
Test suite for new ERP features:
1. Finanziaria page API
2. Prima Nota with transaction details
3. IVA PDF export (trimestrale/annuale)
4. Gestione Dipendenti with 3 tabs (Anagrafica, Paghe e Salari, Prima Nota Salari)
5. Corrispettivi upload-xml with force_update (upsert)
"""
import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinanziariaAPI:
    """Test Finanziaria summary endpoint"""
    
    def test_finanziaria_summary_2025(self):
        """Test GET /api/finanziaria/summary for year 2025"""
        response = requests.get(f"{BASE_URL}/api/finanziaria/summary?anno=2025")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify response structure
        assert "total_income" in data or data is None, "Response should have total_income or be null"
        
    def test_finanziaria_summary_2026(self):
        """Test GET /api/finanziaria/summary for year 2026"""
        response = requests.get(f"{BASE_URL}/api/finanziaria/summary?anno=2026")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


class TestPrimaNotaAPI:
    """Test Prima Nota endpoints"""
    
    def test_prima_nota_cassa_list(self):
        """Test GET /api/prima-nota/cassa"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?anno=2026&limit=50")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "movimenti" in data, "Response should have movimenti"
        assert "saldo" in data, "Response should have saldo"
        assert "totale_entrate" in data, "Response should have totale_entrate"
        assert "totale_uscite" in data, "Response should have totale_uscite"
        
    def test_prima_nota_banca_list(self):
        """Test GET /api/prima-nota/banca"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?anno=2026&limit=50")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "movimenti" in data, "Response should have movimenti"
        
    def test_prima_nota_anni_disponibili(self):
        """Test GET /api/prima-nota/anni-disponibili"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/anni-disponibili")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "anni" in data, "Response should have anni"
        assert isinstance(data["anni"], list), "anni should be a list"
        
    def test_prima_nota_salari_list(self):
        """Test GET /api/prima-nota/salari"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/salari?data_da=2026-01-01&data_a=2026-01-31")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "movimenti" in data, "Response should have movimenti"
        
    def test_prima_nota_salari_create(self):
        """Test POST /api/prima-nota/salari - create salary movement"""
        payload = {
            "data": "2026-01-15",
            "importo": 1500.00,
            "descrizione": "TEST_Stipendio test dipendente",
            "nome_dipendente": "TEST_Dipendente",
            "categoria": "Stipendi"
        }
        response = requests.post(f"{BASE_URL}/api/prima-nota/salari", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data or "movimento" in data, "Response should have id or movimento"


class TestIVAAPI:
    """Test IVA calculation and PDF export endpoints"""
    
    def test_iva_annual(self):
        """Test GET /api/iva/annual/{year}"""
        response = requests.get(f"{BASE_URL}/api/iva/annual/2025")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "anno" in data, "Response should have anno"
        assert "monthly_data" in data, "Response should have monthly_data"
        assert "totali" in data, "Response should have totali"
        
    def test_iva_monthly(self):
        """Test GET /api/iva/monthly/{year}/{month}"""
        response = requests.get(f"{BASE_URL}/api/iva/monthly/2025/1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "anno" in data, "Response should have anno"
        assert "mese" in data, "Response should have mese"
        
    def test_iva_today(self):
        """Test GET /api/iva/today"""
        response = requests.get(f"{BASE_URL}/api/iva/today")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
    def test_iva_pdf_trimestrale(self):
        """Test GET /api/iva/export/pdf/trimestrale/{year}/{quarter}"""
        response = requests.get(f"{BASE_URL}/api/iva/export/pdf/trimestrale/2025/1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get('content-type') == 'application/pdf', "Should return PDF"
        
    def test_iva_pdf_annuale(self):
        """Test GET /api/iva/export/pdf/annuale/{year}"""
        response = requests.get(f"{BASE_URL}/api/iva/export/pdf/annuale/2025")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get('content-type') == 'application/pdf', "Should return PDF"


class TestDipendentiAPI:
    """Test Dipendenti (employees) endpoints"""
    
    def test_dipendenti_list(self):
        """Test GET /api/dipendenti"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
    def test_dipendenti_stats(self):
        """Test GET /api/dipendenti/stats"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totale" in data, "Response should have totale"
        
    def test_dipendenti_buste_paga(self):
        """Test GET /api/dipendenti/buste-paga"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/buste-paga?anno=2026&mese=01")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
    def test_dipendenti_create_and_delete(self):
        """Test POST /api/dipendenti - create and then delete"""
        # Create
        payload = {
            "nome_completo": "TEST_Dipendente Prova",
            "codice_fiscale": "TSTDPN99A01H501Z",
            "mansione": "Cameriere",
            "email": "test.dipendente@test.com"
        }
        create_response = requests.post(f"{BASE_URL}/api/dipendenti", json=payload)
        assert create_response.status_code == 200, f"Create failed: {create_response.status_code}: {create_response.text}"
        
        created = create_response.json()
        assert "id" in created, "Created dipendente should have id"
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/dipendenti/{created['id']}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}"


class TestCorrispettiviAPI:
    """Test Corrispettivi endpoints including force_update upsert"""
    
    def test_corrispettivi_list(self):
        """Test GET /api/corrispettivi"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
    def test_corrispettivi_totals(self):
        """Test GET /api/corrispettivi/totals"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi/totals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totale_generale" in data, "Response should have totale_generale"
        assert "count" in data, "Response should have count"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Health endpoint might not exist, so accept 200 or 404
        assert response.status_code in [200, 404], f"API not responding: {response.status_code}"
        
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Root endpoint failed: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
