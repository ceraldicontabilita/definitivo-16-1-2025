"""
Test Suite for Session Features:
1. Riconciliazione pagination and 'Carica altri' button
2. /api/cedolini endpoint with pagination
3. /api/operazioni-da-confermare/smart/analizza with limit parameter
4. Import Unificato progress bar (frontend only)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCedoliniEndpoint:
    """Test /api/cedolini endpoint - lista cedolini con paginazione"""
    
    def test_cedolini_list_basic(self):
        """Test basic cedolini list endpoint"""
        response = requests.get(f"{BASE_URL}/api/cedolini")
        assert response.status_code == 200
        
        data = response.json()
        assert "cedolini" in data
        assert "total" in data
        assert "filters" in data
        assert isinstance(data["cedolini"], list)
        print(f"✅ Cedolini list: {data['total']} total records")
    
    def test_cedolini_with_limit(self):
        """Test cedolini with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/cedolini?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["cedolini"]) <= 5
        print(f"✅ Cedolini with limit=5: {len(data['cedolini'])} records returned")
    
    def test_cedolini_filter_by_anno(self):
        """Test cedolini filtered by anno"""
        response = requests.get(f"{BASE_URL}/api/cedolini?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        assert data["filters"]["anno"] == 2026
        # Verify all returned cedolini are from 2026
        for ced in data["cedolini"]:
            assert ced.get("anno") == 2026
        print(f"✅ Cedolini filtered by anno=2026: {len(data['cedolini'])} records")
    
    def test_cedolini_filter_by_mese(self):
        """Test cedolini filtered by mese"""
        response = requests.get(f"{BASE_URL}/api/cedolini?mese=1")
        assert response.status_code == 200
        
        data = response.json()
        assert data["filters"]["mese"] == 1
        print(f"✅ Cedolini filtered by mese=1: {len(data['cedolini'])} records")
    
    def test_cedolini_combined_filters(self):
        """Test cedolini with combined filters"""
        response = requests.get(f"{BASE_URL}/api/cedolini?anno=2026&mese=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["filters"]["anno"] == 2026
        assert data["filters"]["mese"] == 1
        print(f"✅ Cedolini with combined filters: {len(data['cedolini'])} records")


class TestSmartAnalizzaEndpoint:
    """Test /api/operazioni-da-confermare/smart/analizza with limit parameter"""
    
    def test_smart_analizza_default(self):
        """Test smart/analizza with default parameters"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza")
        assert response.status_code == 200
        
        data = response.json()
        assert "movimenti" in data
        assert "stats" in data
        print(f"✅ Smart analizza default: {len(data['movimenti'])} movimenti")
    
    def test_smart_analizza_with_limit_10(self):
        """Test smart/analizza with limit=10"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=10")
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["movimenti"]) <= 10
        assert data["stats"]["totale"] == len(data["movimenti"])
        print(f"✅ Smart analizza limit=10: {len(data['movimenti'])} movimenti in {elapsed:.2f}s")
    
    def test_smart_analizza_with_limit_25(self):
        """Test smart/analizza with limit=25 (default for pagination)"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=25")
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["movimenti"]) <= 25
        print(f"✅ Smart analizza limit=25: {len(data['movimenti'])} movimenti in {elapsed:.2f}s")
        
        # Verify response time is reasonable (should be < 5 seconds with pagination)
        assert elapsed < 10, f"Response time too slow: {elapsed:.2f}s"
    
    def test_smart_analizza_with_limit_50(self):
        """Test smart/analizza with limit=50"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=50")
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["movimenti"]) <= 50
        print(f"✅ Smart analizza limit=50: {len(data['movimenti'])} movimenti in {elapsed:.2f}s")
    
    def test_smart_analizza_stats_structure(self):
        """Test smart/analizza stats structure"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=25")
        assert response.status_code == 200
        
        data = response.json()
        stats = data["stats"]
        
        # Verify stats structure
        expected_keys = ["totale", "incasso_pos", "commissione_pos", "prelievo_assegno", 
                        "stipendio", "f24", "fattura_sdd", "non_riconosciuto"]
        for key in expected_keys:
            assert key in stats, f"Missing key in stats: {key}"
        
        print(f"✅ Stats structure verified: {stats}")
    
    def test_smart_analizza_movimenti_structure(self):
        """Test smart/analizza movimenti structure"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["movimenti"]:
            mov = data["movimenti"][0]
            # Verify movimento structure
            assert "movimento_id" in mov
            assert "descrizione" in mov
            assert "importo" in mov
            assert "data" in mov
            assert "tipo" in mov
            print(f"✅ Movimento structure verified: {mov['movimento_id']}")


class TestOtherEndpoints:
    """Test other related endpoints"""
    
    def test_aruba_pendenti(self):
        """Test aruba-pendenti endpoint"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/aruba-pendenti")
        assert response.status_code == 200
        
        data = response.json()
        assert "operazioni" in data
        print(f"✅ Aruba pendenti: {len(data['operazioni'])} operazioni")
    
    def test_cerca_f24(self):
        """Test cerca-f24 endpoint"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/cerca-f24")
        assert response.status_code == 200
        
        data = response.json()
        assert "f24" in data
        print(f"✅ Cerca F24: {len(data['f24'])} F24 trovati")
    
    def test_cerca_stipendi(self):
        """Test cerca-stipendi endpoint"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/cerca-stipendi")
        assert response.status_code == 200
        
        data = response.json()
        assert "stipendi" in data
        print(f"✅ Cerca stipendi: {len(data['stipendi'])} stipendi trovati")


class TestCedoliniAdvanced:
    """Advanced tests for cedolini endpoints"""
    
    def test_cedolini_lista_per_mese(self):
        """Test lista cedolini per mese specifico"""
        response = requests.get(f"{BASE_URL}/api/cedolini/lista/2026/1")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Cedolini lista 2026/1: {len(data)} records")
    
    def test_cedolini_riepilogo_mensile(self):
        """Test riepilogo mensile cedolini"""
        response = requests.get(f"{BASE_URL}/api/cedolini/riepilogo-mensile/2026/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        assert data["anno"] == 2026
        assert data["mese"] == 1
        print(f"✅ Riepilogo mensile: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
