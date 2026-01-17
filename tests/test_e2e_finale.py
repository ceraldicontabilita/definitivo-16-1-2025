"""
Test E2E Finale - ERP Azienda in Cloud
Testing all features before release:
- API corrispettivi with year filter
- API riconciliazione optimized (<5 seconds)
- Fornitori page (155+ suppliers)
- WebSocket status API
- Dipendenti API
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://account-unifier.preview.emergentagent.com')

class TestCorrispettiviAPI:
    """Test corrispettivi API with year filter"""
    
    def test_corrispettivi_filter_anno_2026(self):
        """GET /api/corrispettivi?anno=2026 should return only 2026 data"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned records are from 2026
        for record in data:
            if 'data' in record and record['data']:
                assert record['data'].startswith('2026'), f"Found non-2026 record: {record['data']}"
        
        print(f"✅ Corrispettivi 2026: {len(data)} records returned")
    
    def test_corrispettivi_filter_anno_2025(self):
        """GET /api/corrispettivi?anno=2025 should return only 2025 data"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi?anno=2025")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all returned records are from 2025
        for record in data:
            if 'data' in record and record['data']:
                assert record['data'].startswith('2025'), f"Found non-2025 record: {record['data']}"
        
        print(f"✅ Corrispettivi 2025: {len(data)} records returned")


class TestRiconciliazioneAPI:
    """Test riconciliazione API performance"""
    
    def test_smart_analizza_response_time(self):
        """GET /api/operazioni-da-confermare/smart/analizza should respond in <5 seconds"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=25")
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200
        assert elapsed_time < 5, f"Response took {elapsed_time:.2f}s, expected <5s"
        
        data = response.json()
        assert 'movimenti' in data or 'stats' in data
        
        print(f"✅ Riconciliazione API responded in {elapsed_time:.2f}s")
    
    def test_smart_analizza_with_limit(self):
        """Test limit parameter works correctly"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if 'movimenti' in data:
            assert len(data['movimenti']) <= 10
        
        print(f"✅ Limit parameter working correctly")


class TestFornitoriAPI:
    """Test fornitori API returns 155+ suppliers"""
    
    def test_fornitori_count(self):
        """GET /api/suppliers should return 155+ fornitori"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 155, f"Expected 155+ fornitori, got {len(data)}"
        
        print(f"✅ Fornitori: {len(data)} suppliers returned")
    
    def test_fornitori_data_structure(self):
        """Verify fornitori data structure"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            first_supplier = data[0]
            # Check required fields
            assert 'partita_iva' in first_supplier or 'id' in first_supplier
            assert 'ragione_sociale' in first_supplier or 'denominazione' in first_supplier
        
        print(f"✅ Fornitori data structure valid")


class TestWebSocketAPI:
    """Test WebSocket status API"""
    
    def test_realtime_status(self):
        """GET /api/realtime/status should return status: online"""
        response = requests.get(f"{BASE_URL}/api/realtime/status")
        assert response.status_code == 200
        
        data = response.json()
        assert 'status' in data
        assert data['status'] == 'online'
        
        print(f"✅ WebSocket status: {data['status']}")
    
    def test_realtime_status_connections(self):
        """Verify connections info in status"""
        response = requests.get(f"{BASE_URL}/api/realtime/status")
        assert response.status_code == 200
        
        data = response.json()
        assert 'connections' in data
        
        print(f"✅ WebSocket connections info present")


class TestDipendentiAPI:
    """Test dipendenti API"""
    
    def test_dipendenti_list(self):
        """GET /api/dipendenti should return employees"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least 1 dipendente"
        
        print(f"✅ Dipendenti: {len(data)} employees returned")
    
    def test_dipendenti_data_structure(self):
        """Verify dipendenti data structure"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            first_employee = data[0]
            # Check for common fields
            has_name = 'nome_completo' in first_employee or 'nome' in first_employee or 'cognome' in first_employee
            assert has_name, "Employee should have name field"
        
        print(f"✅ Dipendenti data structure valid")


class TestHealthAPI:
    """Test health and basic APIs"""
    
    def test_health_check(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('status') == 'healthy'
        assert data.get('database') == 'connected'
        
        print(f"✅ Health check passed")
    
    def test_root_api(self):
        """GET /api should return API info"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        
        print(f"✅ Root API accessible")


class TestPrimaNotaAPI:
    """Test prima nota APIs"""
    
    def test_prima_nota_cassa(self):
        """GET /api/prima-nota/cassa should work"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa")
        assert response.status_code == 200
        
        print(f"✅ Prima Nota Cassa API working")
    
    def test_prima_nota_banca(self):
        """GET /api/prima-nota/banca should work"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca")
        assert response.status_code == 200
        
        print(f"✅ Prima Nota Banca API working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
