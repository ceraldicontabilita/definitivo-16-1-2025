"""
Test F24 Riconciliazione APIs - Iteration 36
Tests for the F24 reconciliation system:
- Dashboard statistics
- F24 commercialista list
- Codice tributo verification
- Alerts management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestF24RiconciliazioneDashboard:
    """Test dashboard endpoint for F24 reconciliation"""
    
    def test_dashboard_returns_200(self):
        """Dashboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_dashboard_structure(self):
        """Dashboard should return expected structure"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "f24_commercialista" in data, "Missing f24_commercialista field"
        assert "totale_da_pagare" in data, "Missing totale_da_pagare field"
        assert "quietanze_caricate" in data, "Missing quietanze_caricate field"
        assert "totale_pagato_quietanze" in data, "Missing totale_pagato_quietanze field"
        assert "alerts_pendenti" in data, "Missing alerts_pendenti field"
        assert "f24_in_scadenza" in data, "Missing f24_in_scadenza field"
        
        # Check f24_commercialista structure
        f24_stats = data["f24_commercialista"]
        assert "da_pagare" in f24_stats, "Missing da_pagare in f24_commercialista"
        assert "pagato" in f24_stats, "Missing pagato in f24_commercialista"
        assert "eliminato" in f24_stats, "Missing eliminato in f24_commercialista"
        
        # Check types
        assert isinstance(data["totale_da_pagare"], (int, float)), "totale_da_pagare should be numeric"
        assert isinstance(data["quietanze_caricate"], int), "quietanze_caricate should be int"
        assert isinstance(data["totale_pagato_quietanze"], (int, float)), "totale_pagato_quietanze should be numeric"
        assert isinstance(data["alerts_pendenti"], int), "alerts_pendenti should be int"
        assert isinstance(data["f24_in_scadenza"], list), "f24_in_scadenza should be list"
        
        print(f"Dashboard data: {data}")


class TestF24CommercialistaList:
    """Test F24 commercialista list endpoint"""
    
    def test_list_returns_200(self):
        """List endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/commercialista")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_list_structure(self):
        """List should return expected structure"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/commercialista")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "f24_list" in data, "Missing f24_list field"
        assert "totale" in data, "Missing totale field"
        assert "statistiche" in data, "Missing statistiche field"
        assert "totale_da_pagare" in data, "Missing totale_da_pagare field"
        
        # Check types
        assert isinstance(data["f24_list"], list), "f24_list should be list"
        assert isinstance(data["totale"], int), "totale should be int"
        assert isinstance(data["statistiche"], dict), "statistiche should be dict"
        
        print(f"F24 list: {len(data['f24_list'])} items, totale: {data['totale']}")
    
    def test_list_filter_da_pagare(self):
        """List with status filter should work"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/commercialista?status=da_pagare")
        assert response.status_code == 200
        data = response.json()
        assert "f24_list" in data
        print(f"F24 da_pagare: {len(data['f24_list'])} items")
    
    def test_list_filter_pagato(self):
        """List with pagato filter should work"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/commercialista?status=pagato")
        assert response.status_code == 200
        data = response.json()
        assert "f24_list" in data
        print(f"F24 pagato: {len(data['f24_list'])} items")
    
    def test_list_filter_eliminato(self):
        """List with eliminato filter should work"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/commercialista?status=eliminato")
        assert response.status_code == 200
        data = response.json()
        assert "f24_list" in data
        print(f"F24 eliminato: {len(data['f24_list'])} items")


class TestVerificaCodiceTributo:
    """Test codice tributo verification endpoint"""
    
    def test_verifica_codice_1001(self):
        """Verify codice tributo 1001 (Ritenute lavoro dipendente)"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/verifica-codice/1001")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check structure
        assert "codice_tributo" in data, "Missing codice_tributo field"
        assert "pagato" in data, "Missing pagato field"
        assert "pagamenti" in data, "Missing pagamenti field"
        assert "in_attesa" in data, "Missing in_attesa field"
        
        # Check values
        assert data["codice_tributo"] == "1001", f"Expected codice 1001, got {data['codice_tributo']}"
        assert isinstance(data["pagato"], bool), "pagato should be boolean"
        assert isinstance(data["pagamenti"], list), "pagamenti should be list"
        assert isinstance(data["in_attesa"], list), "in_attesa should be list"
        
        print(f"Codice 1001: pagato={data['pagato']}, pagamenti={len(data['pagamenti'])}, in_attesa={len(data['in_attesa'])}")
    
    def test_verifica_codice_6001(self):
        """Verify codice tributo 6001 (IVA mensile gennaio)"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/verifica-codice/6001")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["codice_tributo"] == "6001", f"Expected codice 6001, got {data['codice_tributo']}"
        assert isinstance(data["pagato"], bool), "pagato should be boolean"
        
        print(f"Codice 6001: pagato={data['pagato']}, pagamenti={len(data['pagamenti'])}, in_attesa={len(data['in_attesa'])}")
    
    def test_verifica_codice_with_anno(self):
        """Verify codice tributo with anno filter"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/verifica-codice/1001?anno=2024")
        assert response.status_code == 200
        data = response.json()
        
        assert "periodo_cercato" in data, "Missing periodo_cercato field"
        print(f"Codice 1001 anno 2024: periodo_cercato={data['periodo_cercato']}")
    
    def test_verifica_codice_with_mese_anno(self):
        """Verify codice tributo with mese and anno filter"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/verifica-codice/1001?mese=12&anno=2024")
        assert response.status_code == 200
        data = response.json()
        
        assert "periodo_cercato" in data, "Missing periodo_cercato field"
        assert data["periodo_cercato"] == "12/2024", f"Expected periodo 12/2024, got {data['periodo_cercato']}"
        print(f"Codice 1001 mese 12/2024: periodo_cercato={data['periodo_cercato']}")
    
    def test_verifica_codice_nonexistent(self):
        """Verify nonexistent codice tributo returns empty results"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/verifica-codice/9999")
        assert response.status_code == 200
        data = response.json()
        
        assert data["codice_tributo"] == "9999"
        # Should return empty results but not error
        print(f"Codice 9999: pagato={data['pagato']}")


class TestAlerts:
    """Test alerts endpoint"""
    
    def test_alerts_returns_200(self):
        """Alerts endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_alerts_structure(self):
        """Alerts should return expected structure"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/alerts")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "alerts" in data, "Missing alerts field"
        assert "count" in data, "Missing count field"
        
        # Check types
        assert isinstance(data["alerts"], list), "alerts should be list"
        assert isinstance(data["count"], int), "count should be int"
        assert data["count"] == len(data["alerts"]), "count should match alerts length"
        
        print(f"Alerts: {data['count']} pending")
    
    def test_alerts_filter_pending(self):
        """Alerts with pending filter should work"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/alerts?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        print(f"Pending alerts: {data['count']}")
    
    def test_alerts_filter_resolved(self):
        """Alerts with resolved filter should work"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/alerts?status=resolved")
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        print(f"Resolved alerts: {data['count']}")
    
    def test_alerts_filter_dismissed(self):
        """Alerts with dismissed filter should work"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/alerts?status=dismissed")
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        print(f"Dismissed alerts: {data['count']}")


class TestUploadEndpoint:
    """Test upload endpoint validation"""
    
    def test_upload_requires_pdf(self):
        """Upload should reject non-PDF files"""
        # Create a fake text file
        files = {'file': ('test.txt', b'test content', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/f24-riconciliazione/commercialista/upload", files=files)
        
        # Should return 400 for non-PDF
        assert response.status_code == 400, f"Expected 400 for non-PDF, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"Non-PDF rejection: {data['detail']}")


class TestF24Detail:
    """Test F24 detail endpoint"""
    
    def test_detail_nonexistent_returns_404(self):
        """Detail for nonexistent F24 should return 404"""
        response = requests.get(f"{BASE_URL}/api/f24-riconciliazione/commercialista/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestAlertActions:
    """Test alert action endpoints"""
    
    def test_conferma_elimina_nonexistent_returns_404(self):
        """Conferma elimina for nonexistent alert should return 404"""
        response = requests.post(f"{BASE_URL}/api/f24-riconciliazione/alerts/nonexistent-alert-id/conferma-elimina")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_ignora_nonexistent_returns_404(self):
        """Ignora for nonexistent alert should return 404"""
        response = requests.post(f"{BASE_URL}/api/f24-riconciliazione/alerts/nonexistent-alert-id/ignora")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
