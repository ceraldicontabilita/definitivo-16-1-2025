"""
Test Iteration 43: HACCP V2 Module Fix Testing
Tests for:
- GET /api/haccp-v2/ricette - List ricette with ingredienti as objects
- GET /api/haccp-v2/lotti - List lotti with items and total
- GET /api/haccp-v2/materie-prime - List materie prime
- POST /api/haccp-v2/ricette - Create new ricetta
- DELETE /api/haccp-v2/ricette/{id} - Delete ricetta
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHACCPV2Ricette:
    """Test HACCP V2 Ricette API endpoints"""
    
    def test_get_ricette_returns_list(self):
        """Test GET /api/haccp-v2/ricette returns array of ricette"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/ricette")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/haccp-v2/ricette returned {len(data)} ricette")
    
    def test_ricette_ingredienti_are_objects(self):
        """Test that ingredienti in ricette are objects with nome, quantita, unita"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/ricette")
        assert response.status_code == 200
        
        data = response.json()
        if data:
            ricetta = data[0]
            ingredienti = ricetta.get("ingredienti", [])
            if ingredienti:
                ing = ingredienti[0]
                assert isinstance(ing, dict), "Ingrediente should be an object"
                assert "nome" in ing, "Ingrediente should have 'nome' field"
                print(f"SUCCESS: Ingredienti are objects with fields: {list(ing.keys())}")
    
    def test_ricette_search_filter(self):
        """Test GET /api/haccp-v2/ricette with search parameter"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/ricette?search=Cornetto")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        if data:
            assert any("cornetto" in r.get("nome", "").lower() for r in data)
            print(f"SUCCESS: Search filter returned {len(data)} ricette matching 'Cornetto'")
    
    def test_create_ricetta(self):
        """Test POST /api/haccp-v2/ricette - Create new ricetta"""
        payload = {
            "nome": "TEST_ITER43_Ricetta",
            "ingredienti": [
                {"nome": "Farina", "quantita": 500, "unita": "g"},
                {"nome": "Zucchero", "quantita": 200, "unita": "g"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/haccp-v2/ricette", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["nome"] == "TEST_ITER43_Ricetta"
        assert len(data["ingredienti"]) == 2
        
        ricetta_id = data["id"]
        print(f"SUCCESS: Created ricetta with id: {ricetta_id}")
        
        # Verify creation with GET
        get_response = requests.get(f"{BASE_URL}/api/haccp-v2/ricette/{ricetta_id}")
        assert get_response.status_code == 200
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/ricette/{ricetta_id}")
        assert delete_response.status_code == 200
        print(f"SUCCESS: Cleaned up test ricetta")
    
    def test_delete_ricetta(self):
        """Test DELETE /api/haccp-v2/ricette/{id}"""
        # First create a ricetta
        payload = {"nome": "TEST_ITER43_Delete", "ingredienti": []}
        create_response = requests.post(f"{BASE_URL}/api/haccp-v2/ricette", json=payload)
        assert create_response.status_code == 200
        ricetta_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/ricette/{ricetta_id}")
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert data.get("success") == True
        print(f"SUCCESS: Deleted ricetta {ricetta_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/haccp-v2/ricette/{ricetta_id}")
        assert get_response.status_code == 404
        print(f"SUCCESS: Verified ricetta no longer exists")
    
    def test_delete_nonexistent_ricetta_returns_404(self):
        """Test DELETE /api/haccp-v2/ricette/{id} with non-existent id returns 404"""
        response = requests.delete(f"{BASE_URL}/api/haccp-v2/ricette/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"SUCCESS: DELETE non-existent ricetta returns 404")


class TestHACCPV2Lotti:
    """Test HACCP V2 Lotti API endpoints"""
    
    def test_get_lotti_returns_object_with_items(self):
        """Test GET /api/haccp-v2/lotti returns object with items and total"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/lotti")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict), "Response should be an object"
        assert "items" in data, "Response should have 'items' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["items"], list), "'items' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        print(f"SUCCESS: GET /api/haccp-v2/lotti returned {data['total']} lotti")
    
    def test_create_lotto(self):
        """Test POST /api/haccp-v2/lotti - Create new lotto"""
        payload = {
            "prodotto": "TEST_ITER43_Lotto_Prodotto",
            "ingredienti_dettaglio": ["Farina", "Zucchero"],
            "data_produzione": datetime.now().strftime("%Y-%m-%d"),
            "data_scadenza": "2026-03-10",
            "numero_lotto": "TEST-001",
            "quantita": 5,
            "unita_misura": "pz"
        }
        
        response = requests.post(f"{BASE_URL}/api/haccp-v2/lotti", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["prodotto"] == "TEST_ITER43_Lotto_Prodotto"
        
        lotto_id = data["id"]
        print(f"SUCCESS: Created lotto with id: {lotto_id}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/lotti/{lotto_id}")
        assert delete_response.status_code == 200
        print(f"SUCCESS: Cleaned up test lotto")
    
    def test_delete_lotto(self):
        """Test DELETE /api/haccp-v2/lotti/{id}"""
        # First create a lotto
        payload = {
            "prodotto": "TEST_ITER43_Delete_Lotto",
            "data_produzione": datetime.now().strftime("%Y-%m-%d"),
            "data_scadenza": "2026-03-10",
            "numero_lotto": "TEST-DEL-001"
        }
        create_response = requests.post(f"{BASE_URL}/api/haccp-v2/lotti", json=payload)
        assert create_response.status_code == 200
        lotto_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/lotti/{lotto_id}")
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert data.get("success") == True
        print(f"SUCCESS: Deleted lotto {lotto_id}")


class TestHACCPV2MateriePrime:
    """Test HACCP V2 Materie Prime API endpoints"""
    
    def test_get_materie_prime_returns_list(self):
        """Test GET /api/haccp-v2/materie-prime returns array"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/materie-prime")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/haccp-v2/materie-prime returned {len(data)} items")
    
    def test_create_materia_prima(self):
        """Test POST /api/haccp-v2/materie-prime - Create new materia prima"""
        payload = {
            "materia_prima": "TEST_ITER43_Materia",
            "azienda": "Test Fornitore",
            "numero_fattura": "FAT-001",
            "data_fattura": datetime.now().strftime("%Y-%m-%d"),
            "allergeni": "non contiene allergeni"
        }
        
        response = requests.post(f"{BASE_URL}/api/haccp-v2/materie-prime", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["materia_prima"] == "TEST_ITER43_Materia"
        
        materia_id = data["id"]
        print(f"SUCCESS: Created materia prima with id: {materia_id}")
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/materie-prime/{materia_id}")
        assert delete_response.status_code == 200
        print(f"SUCCESS: Cleaned up test materia prima")
    
    def test_delete_materia_prima(self):
        """Test DELETE /api/haccp-v2/materie-prime/{id}"""
        # First create a materia prima
        payload = {
            "materia_prima": "TEST_ITER43_Delete_Materia",
            "azienda": "Test Fornitore",
            "numero_fattura": "FAT-DEL-001",
            "data_fattura": datetime.now().strftime("%Y-%m-%d")
        }
        create_response = requests.post(f"{BASE_URL}/api/haccp-v2/materie-prime", json=payload)
        assert create_response.status_code == 200
        materia_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/materie-prime/{materia_id}")
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert data.get("success") == True
        print(f"SUCCESS: Deleted materia prima {materia_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
