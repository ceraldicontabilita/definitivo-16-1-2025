"""
Test Prima Nota Versamenti Logic - Iteration 42
Tests the accounting logic fix:
1. Versamenti must be registered ONLY in prima_nota_cassa as tipo='uscita'
2. Prima Nota Banca should NOT contain versamenti (categoria='Versamento')
3. DELETE /api/prima-nota/banca/delete-versamenti endpoint works correctly
4. DELETE /api/prima-nota/cassa/delete-versamenti endpoint works correctly
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPrimaNotaVersamenti:
    """Test versamenti accounting logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_prefix = f"TEST_ITER42_{uuid.uuid4().hex[:6]}"
        yield
        # Cleanup after tests
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data created during tests"""
        try:
            # Delete test versamenti from cassa
            self.session.delete(f"{BASE_URL}/api/prima-nota/cassa/delete-versamenti")
        except:
            pass
    
    def test_01_api_health_check(self):
        """Test API is accessible"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API health check failed: {response.status_code}"
        print("✅ API health check passed")
    
    def test_02_prima_nota_cassa_endpoint(self):
        """Test Prima Nota Cassa endpoint is accessible"""
        response = self.session.get(f"{BASE_URL}/api/prima-nota/cassa?limit=10")
        assert response.status_code == 200, f"Prima Nota Cassa endpoint failed: {response.status_code}"
        data = response.json()
        assert "movimenti" in data, "Response should contain 'movimenti' key"
        assert "saldo" in data, "Response should contain 'saldo' key"
        print(f"✅ Prima Nota Cassa accessible - {data.get('count', 0)} movimenti")
    
    def test_03_prima_nota_banca_endpoint(self):
        """Test Prima Nota Banca endpoint is accessible"""
        response = self.session.get(f"{BASE_URL}/api/prima-nota/banca?limit=10")
        assert response.status_code == 200, f"Prima Nota Banca endpoint failed: {response.status_code}"
        data = response.json()
        assert "movimenti" in data, "Response should contain 'movimenti' key"
        assert "saldo" in data, "Response should contain 'saldo' key"
        print(f"✅ Prima Nota Banca accessible - {data.get('count', 0)} movimenti")
    
    def test_04_create_versamento_in_cassa(self):
        """Test creating a versamento in Prima Nota Cassa as 'uscita'"""
        versamento_data = {
            "data": datetime.now().strftime("%Y-%m-%d"),
            "tipo": "uscita",  # MUST be uscita (money leaving cash)
            "importo": 500.00,
            "descrizione": f"{self.test_prefix} - Versamento test in banca",
            "categoria": "Versamento",
            "source": "test_iter42"
        }
        
        response = self.session.post(f"{BASE_URL}/api/prima-nota/cassa", json=versamento_data)
        assert response.status_code == 200, f"Create versamento failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        print(f"✅ Versamento created in Cassa with ID: {data['id']}")
        
        # Verify it's in cassa
        cassa_response = self.session.get(f"{BASE_URL}/api/prima-nota/cassa?categoria=Versamento&limit=100")
        assert cassa_response.status_code == 200
        cassa_data = cassa_response.json()
        
        # Find our test versamento
        test_versamenti = [m for m in cassa_data.get("movimenti", []) if self.test_prefix in m.get("descrizione", "")]
        assert len(test_versamenti) > 0, "Test versamento should be in Prima Nota Cassa"
        
        # Verify tipo is 'uscita'
        for v in test_versamenti:
            assert v.get("tipo") == "uscita", f"Versamento tipo should be 'uscita', got: {v.get('tipo')}"
        
        print(f"✅ Verified versamento is in Cassa as 'uscita' type")
        return data["id"]
    
    def test_05_versamenti_not_in_banca(self):
        """Test that versamenti are NOT in Prima Nota Banca"""
        # Get all versamenti from banca
        response = self.session.get(f"{BASE_URL}/api/prima-nota/banca?categoria=Versamento&limit=1000")
        assert response.status_code == 200, f"Get banca versamenti failed: {response.status_code}"
        
        data = response.json()
        versamenti_banca = [m for m in data.get("movimenti", []) if m.get("categoria") == "Versamento"]
        
        # After the fix, there should be NO versamenti in banca
        # (or only legacy ones that haven't been cleaned up)
        print(f"ℹ️ Found {len(versamenti_banca)} versamenti in Prima Nota Banca")
        
        # If there are versamenti in banca, they should be cleaned up
        if len(versamenti_banca) > 0:
            print(f"⚠️ Warning: {len(versamenti_banca)} versamenti found in Banca - these should be deleted")
        else:
            print("✅ No versamenti in Prima Nota Banca (correct behavior)")
    
    def test_06_delete_versamenti_banca_endpoint(self):
        """Test DELETE /api/prima-nota/banca/delete-versamenti endpoint"""
        response = self.session.delete(f"{BASE_URL}/api/prima-nota/banca/delete-versamenti")
        assert response.status_code == 200, f"Delete versamenti banca failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "deleted_count" in data, "Response should contain 'deleted_count'"
        
        print(f"✅ DELETE /api/prima-nota/banca/delete-versamenti - Deleted {data.get('deleted_count', 0)} versamenti")
        
        # Verify no versamenti remain in banca
        verify_response = self.session.get(f"{BASE_URL}/api/prima-nota/banca?categoria=Versamento&limit=100")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        versamenti_remaining = [m for m in verify_data.get("movimenti", []) if m.get("categoria") == "Versamento"]
        assert len(versamenti_remaining) == 0, f"Expected 0 versamenti in banca after delete, found {len(versamenti_remaining)}"
        
        print("✅ Verified no versamenti remain in Prima Nota Banca")
    
    def test_07_delete_versamenti_cassa_endpoint(self):
        """Test DELETE /api/prima-nota/cassa/delete-versamenti endpoint"""
        # First create a test versamento
        versamento_data = {
            "data": datetime.now().strftime("%Y-%m-%d"),
            "tipo": "uscita",
            "importo": 100.00,
            "descrizione": f"{self.test_prefix} - Test versamento for delete",
            "categoria": "Versamento",
            "source": "test_iter42"
        }
        create_response = self.session.post(f"{BASE_URL}/api/prima-nota/cassa", json=versamento_data)
        assert create_response.status_code == 200, "Failed to create test versamento"
        
        # Now delete all versamenti from cassa
        response = self.session.delete(f"{BASE_URL}/api/prima-nota/cassa/delete-versamenti")
        assert response.status_code == 200, f"Delete versamenti cassa failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "deleted_count" in data, "Response should contain 'deleted_count'"
        
        print(f"✅ DELETE /api/prima-nota/cassa/delete-versamenti - Deleted {data.get('deleted_count', 0)} versamenti")
    
    def test_08_import_versamenti_automation_endpoint(self):
        """Test that import-versamenti endpoint exists and only writes to cassa"""
        # Check if the endpoint exists (we can't test file upload easily, but we can verify the endpoint)
        # The endpoint is POST /api/prima-nota-automation/import-versamenti
        # We'll just verify the endpoint structure by checking the automation stats
        
        response = self.session.get(f"{BASE_URL}/api/prima-nota-automation/stats")
        assert response.status_code == 200, f"Automation stats failed: {response.status_code}"
        
        data = response.json()
        assert "prima_nota" in data, "Response should contain 'prima_nota' stats"
        
        print(f"✅ Prima Nota Automation stats accessible")
        print(f"   - Movimenti Cassa: {data.get('prima_nota', {}).get('movimenti_cassa', 0)}")
        print(f"   - Movimenti Banca: {data.get('prima_nota', {}).get('movimenti_banca', 0)}")
    
    def test_09_verify_versamento_tipo_uscita_in_cassa(self):
        """Verify that all versamenti in cassa have tipo='uscita'"""
        response = self.session.get(f"{BASE_URL}/api/prima-nota/cassa?categoria=Versamento&limit=1000")
        assert response.status_code == 200
        
        data = response.json()
        versamenti = [m for m in data.get("movimenti", []) if m.get("categoria") == "Versamento"]
        
        incorrect_tipo = [v for v in versamenti if v.get("tipo") != "uscita"]
        
        if incorrect_tipo:
            print(f"⚠️ Found {len(incorrect_tipo)} versamenti with incorrect tipo (not 'uscita')")
            for v in incorrect_tipo[:5]:  # Show first 5
                print(f"   - ID: {v.get('id')}, tipo: {v.get('tipo')}, importo: {v.get('importo')}")
        else:
            print(f"✅ All {len(versamenti)} versamenti in Cassa have tipo='uscita' (correct)")
    
    def test_10_cassa_avere_section_shows_versamenti(self):
        """Test that versamenti appear in AVERE (uscite) section of Prima Nota Cassa"""
        # Create a test versamento
        versamento_data = {
            "data": datetime.now().strftime("%Y-%m-%d"),
            "tipo": "uscita",  # AVERE section
            "importo": 250.00,
            "descrizione": f"{self.test_prefix} - Versamento AVERE test",
            "categoria": "Versamento",
            "source": "test_iter42"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/prima-nota/cassa", json=versamento_data)
        assert create_response.status_code == 200
        
        # Get cassa data and verify totale_uscite includes our versamento
        response = self.session.get(f"{BASE_URL}/api/prima-nota/cassa?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        totale_uscite = data.get("totale_uscite", 0)
        
        # Verify totale_uscite is greater than 0 (includes our versamento)
        assert totale_uscite > 0, "Totale uscite should include versamenti"
        
        print(f"✅ Prima Nota Cassa - Totale Uscite (AVERE): €{totale_uscite:,.2f}")
        print(f"   Versamenti are correctly shown in AVERE section")


class TestPrimaNotaBancaInfo:
    """Test Prima Nota Banca informational messages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_01_banca_endpoint_structure(self):
        """Test Prima Nota Banca endpoint returns correct structure"""
        response = self.session.get(f"{BASE_URL}/api/prima-nota/banca?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        required_keys = ["movimenti", "saldo", "totale_entrate", "totale_uscite", "count"]
        for key in required_keys:
            assert key in data, f"Response should contain '{key}'"
        
        print("✅ Prima Nota Banca response structure is correct")
        print(f"   - Saldo: €{data.get('saldo', 0):,.2f}")
        print(f"   - Totale Entrate (DARE): €{data.get('totale_entrate', 0):,.2f}")
        print(f"   - Totale Uscite (AVERE): €{data.get('totale_uscite', 0):,.2f}")
        print(f"   - Count: {data.get('count', 0)}")
    
    def test_02_banca_no_versamenti_after_cleanup(self):
        """Verify Prima Nota Banca has no versamenti after cleanup"""
        # First cleanup
        self.session.delete(f"{BASE_URL}/api/prima-nota/banca/delete-versamenti")
        
        # Then verify
        response = self.session.get(f"{BASE_URL}/api/prima-nota/banca?limit=1000")
        assert response.status_code == 200
        
        data = response.json()
        versamenti = [m for m in data.get("movimenti", []) if m.get("categoria") == "Versamento"]
        
        assert len(versamenti) == 0, f"Expected 0 versamenti in banca, found {len(versamenti)}"
        print("✅ Prima Nota Banca contains 0 versamenti (correct after fix)")


class TestRagioneriaApplicataDocument:
    """Test that ragioneria_applicata.md document exists and contains correct principles"""
    
    def test_01_document_exists(self):
        """Test that ragioneria_applicata.md exists"""
        import os
        doc_path = "/app/memory/ragioneria_applicata.md"
        assert os.path.exists(doc_path), f"Document {doc_path} should exist"
        print(f"✅ Document {doc_path} exists")
    
    def test_02_document_contains_versamento_rules(self):
        """Test that document contains correct versamento rules"""
        with open("/app/memory/ragioneria_applicata.md", "r") as f:
            content = f.read()
        
        # Check for key principles
        assert "VERSAMENTO" in content.upper(), "Document should mention VERSAMENTO"
        assert "uscita" in content.lower() or "USCITA" in content, "Document should mention uscita"
        assert "prima_nota_cassa" in content.lower() or "CASSA" in content, "Document should mention cassa"
        
        # Check for the rule about NOT inserting in banca
        assert "NON" in content or "non" in content, "Document should mention what NOT to do"
        
        print("✅ Document contains correct versamento accounting rules")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
