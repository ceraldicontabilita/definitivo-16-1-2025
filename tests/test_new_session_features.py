"""
Test suite for new ERP features implemented in this session:
1. Bank Statement Import with automatic reconciliation
2. HACCP Severity System (4 levels: critica, alta, media, bassa)
3. Global Search in sidebar
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBankStatementReconciliation:
    """Tests for bank statement import and reconciliation endpoints"""
    
    def test_bank_statement_stats_endpoint(self):
        """GET /api/bank-statement/stats - Returns reconciliation statistics"""
        response = requests.get(f"{BASE_URL}/api/bank-statement/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "estratti_conto_importati" in data
        assert "movimenti_banca_totali" in data
        assert "movimenti_riconciliati" in data
        assert "movimenti_non_riconciliati" in data
        assert "percentuale_riconciliazione" in data
        
        # Verify data types
        assert isinstance(data["estratti_conto_importati"], int)
        assert isinstance(data["movimenti_banca_totali"], int)
        assert isinstance(data["movimenti_riconciliati"], int)
        assert isinstance(data["movimenti_non_riconciliati"], int)
        assert isinstance(data["percentuale_riconciliazione"], (int, float))
        
        # Verify logical consistency
        assert data["movimenti_riconciliati"] + data["movimenti_non_riconciliati"] == data["movimenti_banca_totali"]
        print(f"✅ Bank statement stats: {data['movimenti_banca_totali']} total movements, {data['percentuale_riconciliazione']}% reconciled")
    
    def test_portal_upload_endpoint_exists(self):
        """POST /api/portal/upload - Endpoint exists and handles requests"""
        # Test without file - should return 422 (validation error for missing file)
        response = requests.post(f"{BASE_URL}/api/portal/upload")
        assert response.status_code == 422  # Missing required file parameter
        print("✅ Portal upload endpoint exists and validates input")
    
    def test_portal_upload_with_invalid_kind(self):
        """POST /api/portal/upload - Test with generic upload (no kind)"""
        # Create a simple test file
        files = {'file': ('test.txt', b'test content', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/portal/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "filename" in data
        print(f"✅ Generic upload works: {data.get('message')}")


class TestHACCPSeveritySystem:
    """Tests for HACCP notification severity system (4 levels)"""
    
    def test_haccp_notifiche_stats_endpoint(self):
        """GET /api/haccp-completo/notifiche/stats - Returns severity statistics"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/notifiche/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "per_severita" in data
        assert "per_categoria" in data
        assert "totale_non_lette" in data
        assert "livelli_severita" in data
        
        # Verify severity levels documentation
        livelli = data["livelli_severita"]
        assert "critica" in livelli
        assert "alta" in livelli
        assert "media" in livelli
        assert "bassa" in livelli
        
        print(f"✅ HACCP stats: {data['totale_non_lette']} unread notifications")
        print(f"   Severity levels: {list(livelli.keys())}")
    
    def test_haccp_notifiche_list_endpoint(self):
        """GET /api/haccp-completo/notifiche - Returns notification list"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/notifiche")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifiche" in data
        assert "totale" in data
        assert "non_lette" in data
        
        # If there are notifications, verify structure
        if data["notifiche"]:
            notifica = data["notifiche"][0]
            assert "id" in notifica
            assert "tipo" in notifica
            assert "severita" in notifica
            assert "letta" in notifica
            # Verify severity is one of the 4 levels
            assert notifica["severita"] in ["critica", "alta", "media", "bassa"]
            print(f"✅ Notification structure valid, severity: {notifica['severita']}")
        else:
            print("✅ Notification list endpoint works (no notifications)")
    
    def test_haccp_notifiche_filter_non_lette(self):
        """GET /api/haccp-completo/notifiche?solo_non_lette=true - Filter unread"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/notifiche?solo_non_lette=true")
        assert response.status_code == 200
        
        data = response.json()
        # All returned notifications should be unread
        for notifica in data.get("notifiche", []):
            assert notifica.get("letta") == False
        
        print(f"✅ Filter works: {len(data.get('notifiche', []))} unread notifications")
    
    def test_haccp_check_anomalie_endpoint(self):
        """POST /api/haccp-completo/notifiche/check-anomalie - Check for anomalies"""
        response = requests.post(f"{BASE_URL}/api/haccp-completo/notifiche/check-anomalie")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        assert "anomalie_rilevate" in data
        assert "notifiche_create" in data
        
        print(f"✅ Anomaly check: {data['anomalie_rilevate']} anomalies detected, {data['notifiche_create']} notifications created")


class TestGlobalSearch:
    """Tests for global search functionality"""
    
    def test_global_search_basic(self):
        """GET /api/ricerca-globale?q=test&limit=5 - Basic search"""
        response = requests.get(f"{BASE_URL}/api/ricerca-globale?q=test&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "query" in data
        assert "total" in data
        assert "results" in data
        assert data["query"] == "test"
        
        print(f"✅ Global search: {data['total']} results for 'test'")
    
    def test_global_search_result_structure(self):
        """Verify search result structure"""
        response = requests.get(f"{BASE_URL}/api/ricerca-globale?q=test&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if data["results"]:
            result = data["results"][0]
            assert "tipo" in result
            assert "id" in result
            assert "titolo" in result
            assert "sottotitolo" in result
            
            # Verify tipo is one of expected values
            assert result["tipo"] in ["fattura", "fornitore", "prodotto", "dipendente"]
            print(f"✅ Result structure valid: {result['tipo']} - {result['titolo']}")
        else:
            print("✅ Search endpoint works (no results for 'test')")
    
    def test_global_search_different_queries(self):
        """Test search with different queries"""
        queries = ["fattura", "fornitore", "dipendente"]
        
        for q in queries:
            response = requests.get(f"{BASE_URL}/api/ricerca-globale?q={q}&limit=3")
            assert response.status_code == 200
            data = response.json()
            print(f"   Search '{q}': {data['total']} results")
        
        print("✅ Multiple search queries work")
    
    def test_global_search_min_length_validation(self):
        """Search requires minimum 2 characters"""
        response = requests.get(f"{BASE_URL}/api/ricerca-globale?q=a&limit=5")
        # Should return 422 validation error for query too short
        assert response.status_code == 422
        print("✅ Minimum query length validation works")
    
    def test_global_search_limit_parameter(self):
        """Test limit parameter"""
        response = requests.get(f"{BASE_URL}/api/ricerca-globale?q=test&limit=2")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["results"]) <= 2
        print(f"✅ Limit parameter works: {len(data['results'])} results (limit=2)")


class TestIntegration:
    """Integration tests for the new features"""
    
    def test_all_new_endpoints_accessible(self):
        """Verify all new endpoints are accessible"""
        endpoints = [
            ("GET", "/api/bank-statement/stats"),
            ("GET", "/api/haccp-completo/notifiche/stats"),
            ("GET", "/api/ricerca-globale?q=test&limit=5"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}")
            else:
                response = requests.post(f"{BASE_URL}{endpoint}")
            
            assert response.status_code == 200, f"Failed: {method} {endpoint}"
            print(f"   ✅ {method} {endpoint}")
        
        print("✅ All new endpoints accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
