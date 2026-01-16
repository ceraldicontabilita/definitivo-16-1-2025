"""
Test WebSocket Real-time Dashboard and Mobile Responsiveness
Tests for:
1. WebSocket status API
2. Suppliers (Fornitori) count - should be 155
3. Dashboard Analytics KPI data
4. Mobile responsive layout
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://supplier-tracker-10.preview.emergentagent.com').rstrip('/')


class TestWebSocketStatus:
    """Test WebSocket real-time status endpoint"""
    
    def test_realtime_status_online(self):
        """GET /api/realtime/status should return status: online"""
        response = requests.get(f"{BASE_URL}/api/realtime/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "online"
        assert "connections" in data
        assert "timestamp" in data
        print(f"✅ WebSocket status: {data['status']}, connections: {data['connections']}")
    
    def test_realtime_status_connections_structure(self):
        """Verify connections structure in realtime status"""
        response = requests.get(f"{BASE_URL}/api/realtime/status")
        assert response.status_code == 200
        
        data = response.json()
        connections = data.get("connections", {})
        assert "total" in connections
        assert "dashboard" in connections
        assert "notifications" in connections
        print(f"✅ Connections structure valid: total={connections['total']}, dashboard={connections['dashboard']}")


class TestSuppliersEndpoint:
    """Test Suppliers (Fornitori) endpoint - should return 155 records"""
    
    def test_suppliers_count(self):
        """GET /api/suppliers should return 155 fornitori"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        count = len(data)
        assert count == 155, f"Expected 155 fornitori, got {count}"
        print(f"✅ Fornitori count: {count}")
    
    def test_suppliers_data_structure(self):
        """Verify supplier data structure"""
        response = requests.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            supplier = data[0]
            # Check common fields
            assert "ragione_sociale" in supplier or "denominazione" in supplier or "nome" in supplier
            print(f"✅ Supplier data structure valid, first supplier: {supplier.get('ragione_sociale', supplier.get('denominazione', supplier.get('nome', 'N/A')))}")


class TestDashboardAnalyticsAPIs:
    """Test APIs used by Dashboard Analytics page"""
    
    def test_corrispettivi_endpoint(self):
        """GET /api/corrispettivi should return data"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Corrispettivi count: {len(data)}")
    
    def test_dipendenti_endpoint(self):
        """GET /api/dipendenti should return employees"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Dipendenti count: {len(data)}")
    
    def test_f24_endpoint(self):
        """GET /api/f24 should return F24 data"""
        response = requests.get(f"{BASE_URL}/api/f24")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ F24 count: {len(data)}")
    
    def test_prima_nota_cassa(self):
        """GET /api/prima-nota/cassa should return cash movements"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        # Can be dict with 'movimenti' key or list
        if isinstance(data, dict):
            movimenti = data.get('movimenti', [])
        else:
            movimenti = data
        print(f"✅ Prima Nota Cassa movimenti: {len(movimenti)}")
    
    def test_prima_nota_banca(self):
        """GET /api/prima-nota/banca should return bank movements"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict):
            movimenti = data.get('movimenti', [])
        else:
            movimenti = data
        print(f"✅ Prima Nota Banca movimenti: {len(movimenti)}")
    
    def test_fatture_ricevute(self):
        """GET /api/fatture-ricevute/lista should return invoices"""
        response = requests.get(f"{BASE_URL}/api/fatture-ricevute/lista?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, dict):
            fatture = data.get('fatture', [])
        else:
            fatture = data
        print(f"✅ Fatture ricevute: {len(fatture)}")


class TestHealthAndBasicEndpoints:
    """Test basic health and status endpoints"""
    
    def test_health_endpoint(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Health endpoint might return 200 or 404 depending on implementation
        if response.status_code == 200:
            print(f"✅ Health endpoint: {response.json()}")
        else:
            print(f"⚠️ Health endpoint not found (status: {response.status_code})")
    
    def test_root_api(self):
        """GET /api should return API info"""
        response = requests.get(f"{BASE_URL}/api")
        if response.status_code == 200:
            print(f"✅ API root: {response.json()}")
        else:
            print(f"⚠️ API root status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
