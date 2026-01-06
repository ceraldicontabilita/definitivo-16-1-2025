"""
Test suite for new ERP features:
- PDF Export for IRES/IRAP declaration
- IRES/IRAP calculation API
- Dashboard widget data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://smartax-5.preview.emergentagent.com').rstrip('/')


class TestPDFExport:
    """Tests for PDF export endpoint"""
    
    def test_pdf_export_returns_200(self):
        """Test that PDF export endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/contabilita/export/pdf-dichiarazione?anno=2024&regione=campania")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_pdf_export_content_type(self):
        """Test that PDF export returns correct content type"""
        response = requests.get(f"{BASE_URL}/api/contabilita/export/pdf-dichiarazione?anno=2024&regione=campania")
        assert response.status_code == 200
        assert 'application/pdf' in response.headers.get('Content-Type', ''), f"Expected PDF content type, got {response.headers.get('Content-Type')}"
    
    def test_pdf_export_valid_pdf(self):
        """Test that PDF export returns valid PDF content"""
        response = requests.get(f"{BASE_URL}/api/contabilita/export/pdf-dichiarazione?anno=2024&regione=campania")
        assert response.status_code == 200
        # PDF files start with %PDF
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF file"
    
    def test_pdf_export_with_different_regions(self):
        """Test PDF export with different regions"""
        regions = ['campania', 'lombardia', 'lazio', 'default']
        for region in regions:
            response = requests.get(f"{BASE_URL}/api/contabilita/export/pdf-dichiarazione?anno=2024&regione={region}")
            assert response.status_code == 200, f"Failed for region {region}"


class TestCalcoloImposte:
    """Tests for IRES/IRAP calculation API"""
    
    def test_calcolo_imposte_returns_200(self):
        """Test that calcolo imposte endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte?regione=campania")
        assert response.status_code == 200
    
    def test_calcolo_imposte_structure(self):
        """Test that calcolo imposte returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte?regione=campania")
        assert response.status_code == 200
        data = response.json()
        
        # Check main fields
        assert 'utile_civilistico' in data, "Missing utile_civilistico"
        assert 'ires' in data, "Missing ires section"
        assert 'irap' in data, "Missing irap section"
        assert 'totale_imposte' in data, "Missing totale_imposte"
        assert 'aliquota_effettiva' in data, "Missing aliquota_effettiva"
    
    def test_calcolo_imposte_ires_structure(self):
        """Test IRES section structure"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte?regione=campania")
        assert response.status_code == 200
        data = response.json()
        
        ires = data.get('ires', {})
        assert 'variazioni_aumento' in ires, "Missing variazioni_aumento"
        assert 'variazioni_diminuzione' in ires, "Missing variazioni_diminuzione"
        assert 'reddito_imponibile' in ires, "Missing reddito_imponibile"
        assert 'aliquota' in ires, "Missing aliquota"
        assert 'imposta_dovuta' in ires, "Missing imposta_dovuta"
        assert ires['aliquota'] == 24.0, f"Expected IRES aliquota 24%, got {ires['aliquota']}"
    
    def test_calcolo_imposte_irap_structure(self):
        """Test IRAP section structure"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte?regione=campania")
        assert response.status_code == 200
        data = response.json()
        
        irap = data.get('irap', {})
        assert 'regione' in irap, "Missing regione"
        assert 'aliquota' in irap, "Missing aliquota"
        assert 'valore_produzione' in irap, "Missing valore_produzione"
        assert 'base_imponibile' in irap, "Missing base_imponibile"
        assert 'imposta_dovuta' in irap, "Missing imposta_dovuta"
    
    def test_calcolo_imposte_campania_aliquota(self):
        """Test that Campania region has correct IRAP aliquota (4.97%)"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte?regione=campania")
        assert response.status_code == 200
        data = response.json()
        
        irap = data.get('irap', {})
        assert irap.get('aliquota') == 4.97, f"Expected Campania IRAP 4.97%, got {irap.get('aliquota')}"
        assert irap.get('regione') == 'campania', f"Expected regione campania, got {irap.get('regione')}"
    
    def test_calcolo_imposte_totale_consistency(self):
        """Test that totale_imposte equals IRES + IRAP"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte?regione=campania")
        assert response.status_code == 200
        data = response.json()
        
        ires_dovuta = data.get('ires', {}).get('imposta_dovuta', 0)
        irap_dovuta = data.get('irap', {}).get('imposta_dovuta', 0)
        totale = data.get('totale_imposte', 0)
        
        expected_totale = round(ires_dovuta + irap_dovuta, 2)
        assert abs(totale - expected_totale) < 0.1, f"Totale imposte mismatch: {totale} != {expected_totale}"


class TestAliquoteIRAP:
    """Tests for IRAP aliquote endpoint"""
    
    def test_aliquote_irap_returns_200(self):
        """Test that aliquote IRAP endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/contabilita/aliquote-irap")
        assert response.status_code == 200
    
    def test_aliquote_irap_structure(self):
        """Test aliquote IRAP response structure"""
        response = requests.get(f"{BASE_URL}/api/contabilita/aliquote-irap")
        assert response.status_code == 200
        data = response.json()
        
        assert 'aliquote' in data, "Missing aliquote"
        assert 'nota' in data, "Missing nota"
        assert isinstance(data['aliquote'], dict), "aliquote should be a dict"
    
    def test_aliquote_irap_campania(self):
        """Test that Campania aliquota is 4.97%"""
        response = requests.get(f"{BASE_URL}/api/contabilita/aliquote-irap")
        assert response.status_code == 200
        data = response.json()
        
        aliquote = data.get('aliquote', {})
        assert 'campania' in aliquote, "Missing campania in aliquote"
        assert aliquote['campania'] == 4.97, f"Expected Campania 4.97%, got {aliquote['campania']}"


class TestBilancioDettagliato:
    """Tests for bilancio dettagliato endpoint"""
    
    def test_bilancio_dettagliato_returns_200(self):
        """Test that bilancio dettagliato endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/contabilita/bilancio-dettagliato")
        assert response.status_code == 200
    
    def test_bilancio_dettagliato_structure(self):
        """Test bilancio dettagliato response structure"""
        response = requests.get(f"{BASE_URL}/api/contabilita/bilancio-dettagliato")
        assert response.status_code == 200
        data = response.json()
        
        assert 'stato_patrimoniale' in data, "Missing stato_patrimoniale"
        assert 'conto_economico' in data, "Missing conto_economico"
        assert 'data_generazione' in data, "Missing data_generazione"


class TestStatisticheCategorizzazione:
    """Tests for statistiche categorizzazione endpoint"""
    
    def test_statistiche_returns_200(self):
        """Test that statistiche endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/contabilita/statistiche-categorizzazione")
        assert response.status_code == 200
    
    def test_statistiche_structure(self):
        """Test statistiche response structure"""
        response = requests.get(f"{BASE_URL}/api/contabilita/statistiche-categorizzazione")
        assert response.status_code == 200
        data = response.json()
        
        assert 'distribuzione_categorie' in data, "Missing distribuzione_categorie"
        assert 'totale_categorizzate' in data, "Missing totale_categorizzate"
        assert 'percentuale_copertura' in data, "Missing percentuale_copertura"


class TestDashboardEndpoints:
    """Tests for dashboard-related endpoints"""
    
    def test_dashboard_summary_returns_200(self):
        """Test dashboard summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary?anno=2026")
        assert response.status_code == 200
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy' or 'database' in data


class TestRegoleCategorizzazione:
    """Tests for regole categorizzazione endpoints"""
    
    def test_get_regole_fornitori(self):
        """Test get regole fornitori"""
        response = requests.get(f"{BASE_URL}/api/regole-categorizzazione/fornitori")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of rules"
    
    def test_get_regole_descrizioni(self):
        """Test get regole descrizioni"""
        response = requests.get(f"{BASE_URL}/api/regole-categorizzazione/descrizioni")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of rules"
    
    def test_get_categorie(self):
        """Test get categorie"""
        response = requests.get(f"{BASE_URL}/api/regole-categorizzazione/categorie")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of categories"
    
    def test_excel_export(self):
        """Test Excel export for regole"""
        response = requests.get(f"{BASE_URL}/api/regole-categorizzazione/export-excel")
        assert response.status_code == 200
        # Check for Excel content type
        content_type = response.headers.get('Content-Type', '')
        assert 'spreadsheet' in content_type or 'excel' in content_type or 'octet-stream' in content_type


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
