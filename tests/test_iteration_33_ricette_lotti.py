"""
Test Iteration 33: Ricette e Lotti Production Feature
Tests for:
- Ricette list with alphabet filter
- Genera Lotto modal and production
- Registro Lotti page with stats and filters
- API endpoints for ricette, lotti, and produzioni
"""
import pytest
import requests
import os
import re
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRicetteAPI:
    """Test Ricette API endpoints"""
    
    def test_list_ricette(self):
        """Test GET /api/ricette - List all ricette"""
        response = requests.get(f"{BASE_URL}/api/ricette")
        assert response.status_code == 200
        
        data = response.json()
        assert "ricette" in data
        assert "totale" in data
        assert isinstance(data["ricette"], list)
        print(f"SUCCESS: Found {data['totale']} ricette")
    
    def test_list_ricette_with_search(self):
        """Test GET /api/ricette with search parameter"""
        response = requests.get(f"{BASE_URL}/api/ricette?search=Cappuccino")
        assert response.status_code == 200
        
        data = response.json()
        assert "ricette" in data
        # Should find at least one ricetta with "Cappuccino"
        if data["ricette"]:
            assert any("cappuccino" in r.get("nome", "").lower() for r in data["ricette"])
            print(f"SUCCESS: Search found {len(data['ricette'])} ricette matching 'Cappuccino'")
    
    def test_list_ricette_with_categoria(self):
        """Test GET /api/ricette with categoria filter"""
        response = requests.get(f"{BASE_URL}/api/ricette?categoria=pasticceria")
        assert response.status_code == 200
        
        data = response.json()
        assert "ricette" in data
        print(f"SUCCESS: Found {len(data['ricette'])} ricette in 'pasticceria' category")
    
    def test_get_categorie(self):
        """Test GET /api/ricette/categorie - List categories"""
        response = requests.get(f"{BASE_URL}/api/ricette/categorie")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Found {len(data)} categories: {data}")


class TestLottiAPI:
    """Test Lotti API endpoints"""
    
    def test_list_lotti(self):
        """Test GET /api/ricette/lotti - List all lotti"""
        response = requests.get(f"{BASE_URL}/api/ricette/lotti")
        assert response.status_code == 200
        
        data = response.json()
        assert "lotti" in data
        assert "totale" in data
        assert "per_stato" in data
        assert isinstance(data["lotti"], list)
        print(f"SUCCESS: Found {data['totale']} lotti")
        print(f"Stats per stato: {data['per_stato']}")
    
    def test_list_lotti_with_stato_filter(self):
        """Test GET /api/ricette/lotti with stato filter"""
        response = requests.get(f"{BASE_URL}/api/ricette/lotti?stato=disponibile")
        assert response.status_code == 200
        
        data = response.json()
        assert "lotti" in data
        # All returned lotti should have stato=disponibile
        for lotto in data["lotti"]:
            assert lotto.get("stato") == "disponibile"
        print(f"SUCCESS: Found {len(data['lotti'])} lotti with stato 'disponibile'")
    
    def test_lotto_code_format(self):
        """Test that lotto codes follow the format NOME-PROG-QTÀunità-DDMMYYYY"""
        response = requests.get(f"{BASE_URL}/api/ricette/lotti")
        assert response.status_code == 200
        
        data = response.json()
        for lotto in data["lotti"]:
            codice = lotto.get("codice_lotto", "")
            # Format: NOME-###-QTÀunità-DDMMYYYY
            # Example: CAPPUCCI-001-1pz-06012026
            pattern = r'^[A-Z0-9]+-\d{3}-\d+[a-z]+-\d{8}$'
            assert re.match(pattern, codice), f"Lotto code '{codice}' doesn't match expected format"
            print(f"SUCCESS: Lotto code '{codice}' matches expected format")
    
    def test_lotto_has_tracciabilita(self):
        """Test that lotti have ingredienti tracciabilità"""
        response = requests.get(f"{BASE_URL}/api/ricette/lotti")
        assert response.status_code == 200
        
        data = response.json()
        if data["lotti"]:
            lotto = data["lotti"][0]
            assert "ingredienti" in lotto
            print(f"SUCCESS: Lotto has {len(lotto.get('ingredienti', []))} ingredienti for tracciabilità")


class TestProduzioniAPI:
    """Test Produzioni API endpoints"""
    
    def test_list_produzioni(self):
        """Test GET /api/ricette/produzioni - List all produzioni"""
        response = requests.get(f"{BASE_URL}/api/ricette/produzioni")
        assert response.status_code == 200
        
        data = response.json()
        assert "produzioni" in data
        assert "totale" in data
        assert "statistiche" in data
        print(f"SUCCESS: Found {data['totale']} produzioni")
        print(f"Stats: {data['statistiche']}")
    
    def test_create_produzione(self):
        """Test POST /api/ricette/produzioni - Create new production (lotto)"""
        # First, get a ricetta to produce
        ricette_response = requests.get(f"{BASE_URL}/api/ricette")
        assert ricette_response.status_code == 200
        
        ricette = ricette_response.json().get("ricette", [])
        if not ricette:
            pytest.skip("No ricette available to test production")
        
        ricetta = ricette[0]
        ricetta_id = ricetta.get("id")
        
        # Create production
        payload = {
            "ricetta_id": ricetta_id,
            "quantita": 2,
            "unita": "pz",
            "data_produzione": datetime.now().strftime("%Y-%m-%d"),
            "scadenza": "2026-03-06",
            "conservazione": "frigo",
            "note": "Test production from pytest"
        }
        
        response = requests.post(f"{BASE_URL}/api/ricette/produzioni", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "codice_lotto" in data
        assert "progressivo" in data
        assert "quantita_prodotta" in data
        assert data["quantita_prodotta"] == 2
        
        # Verify lotto code format
        codice = data["codice_lotto"]
        pattern = r'^[A-Z0-9]+-\d{3}-2pz-\d{8}$'
        assert re.match(pattern, codice), f"Generated lotto code '{codice}' doesn't match expected format"
        
        print(f"SUCCESS: Created production with lotto code: {codice}")
        print(f"Costo totale: {data.get('costo_totale')}, Costo per unità: {data.get('costo_per_unita')}")
        
        # Verify the lotto appears in the registry
        lotti_response = requests.get(f"{BASE_URL}/api/ricette/lotti")
        assert lotti_response.status_code == 200
        
        lotti = lotti_response.json().get("lotti", [])
        found = any(l.get("codice_lotto") == codice for l in lotti)
        assert found, f"Created lotto '{codice}' not found in registry"
        print(f"SUCCESS: Lotto '{codice}' found in registry")


class TestLottoStatoUpdate:
    """Test Lotto stato update functionality"""
    
    def test_update_lotto_stato(self):
        """Test PUT /api/ricette/lotti/{codice}/stato - Update lotto stato"""
        # Get a lotto to update
        response = requests.get(f"{BASE_URL}/api/ricette/lotti")
        assert response.status_code == 200
        
        lotti = response.json().get("lotti", [])
        if not lotti:
            pytest.skip("No lotti available to test stato update")
        
        # Find a lotto with stato 'disponibile'
        lotto = next((l for l in lotti if l.get("stato") == "disponibile"), None)
        if not lotto:
            pytest.skip("No lotti with stato 'disponibile' to test")
        
        codice = lotto.get("codice_lotto")
        
        # Update stato to 'venduto'
        update_response = requests.put(
            f"{BASE_URL}/api/ricette/lotti/{codice}/stato",
            json={"stato": "venduto"}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data.get("success") == True
        print(f"SUCCESS: Updated lotto '{codice}' stato to 'venduto'")
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/ricette/lotti")
        assert verify_response.status_code == 200
        
        updated_lotti = verify_response.json().get("lotti", [])
        updated_lotto = next((l for l in updated_lotti if l.get("codice_lotto") == codice), None)
        assert updated_lotto is not None
        assert updated_lotto.get("stato") == "venduto"
        print(f"SUCCESS: Verified lotto stato is now 'venduto'")
        
        # Revert back to 'disponibile' for cleanup
        revert_response = requests.put(
            f"{BASE_URL}/api/ricette/lotti/{codice}/stato",
            json={"stato": "disponibile"}
        )
        assert revert_response.status_code == 200
        print(f"SUCCESS: Reverted lotto stato back to 'disponibile'")


class TestRicettaCRUD:
    """Test Ricetta CRUD operations"""
    
    def test_create_ricetta(self):
        """Test POST /api/ricette - Create new ricetta"""
        payload = {
            "nome": "TEST_Ricetta_Pytest",
            "categoria": "pasticceria",
            "porzioni": 10,
            "prezzo_vendita": 25.00,
            "allergeni": ["glutine", "latte"],
            "ingredienti": [
                {"nome": "Farina", "quantita": 500, "unita": "g"},
                {"nome": "Zucchero", "quantita": 200, "unita": "g"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/ricette", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "message" in data
        
        ricetta_id = data["id"]
        print(f"SUCCESS: Created ricetta with id: {ricetta_id}")
        
        # Verify the ricetta was created
        get_response = requests.get(f"{BASE_URL}/api/ricette/{ricetta_id}")
        assert get_response.status_code == 200
        
        ricetta = get_response.json()
        assert ricetta.get("nome") == "TEST_Ricetta_Pytest"
        assert ricetta.get("categoria") == "pasticceria"
        assert ricetta.get("porzioni") == 10
        print(f"SUCCESS: Verified ricetta creation")
        
        # Cleanup - delete the ricetta
        delete_response = requests.delete(f"{BASE_URL}/api/ricette/{ricetta_id}")
        assert delete_response.status_code == 200
        print(f"SUCCESS: Cleaned up test ricetta")
    
    def test_update_ricetta(self):
        """Test PUT /api/ricette/{id} - Update ricetta"""
        # First create a ricetta
        create_payload = {
            "nome": "TEST_Update_Ricetta",
            "categoria": "bar",
            "porzioni": 5,
            "prezzo_vendita": 10.00
        }
        
        create_response = requests.post(f"{BASE_URL}/api/ricette", json=create_payload)
        assert create_response.status_code == 200
        ricetta_id = create_response.json()["id"]
        
        # Update the ricetta
        update_payload = {
            "nome": "TEST_Update_Ricetta_Modified",
            "prezzo_vendita": 15.00
        }
        
        update_response = requests.put(f"{BASE_URL}/api/ricette/{ricetta_id}", json=update_payload)
        assert update_response.status_code == 200
        print(f"SUCCESS: Updated ricetta")
        
        # Verify the update
        get_response = requests.get(f"{BASE_URL}/api/ricette/{ricetta_id}")
        assert get_response.status_code == 200
        
        ricetta = get_response.json()
        assert ricetta.get("nome") == "TEST_Update_Ricetta_Modified"
        assert ricetta.get("prezzo_vendita") == 15.00
        print(f"SUCCESS: Verified ricetta update")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/ricette/{ricetta_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
