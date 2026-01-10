"""
Test HACCP V2 Module - Iteration 47
Tests for:
- Ricettario Dinamico (XML-Driven)
- Non Conformità HACCP
- Temperature Positive/Negative
- Sanificazione
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRicettarioDinamico:
    """Tests for Ricettario Dinamico API"""
    
    def test_lista_ricette(self):
        """Test GET /api/haccp-v2/ricettario - Lista ricette con food cost"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/ricettario")
        assert response.status_code == 200
        
        data = response.json()
        assert "ricette" in data
        assert "totale" in data
        assert "categorie" in data
        assert isinstance(data["ricette"], list)
        assert isinstance(data["totale"], int)
        
        # Verify ricette have expected fields
        if len(data["ricette"]) > 0:
            ricetta = data["ricette"][0]
            assert "id" in ricetta
            assert "nome" in ricetta
            assert "food_cost" in ricetta
            print(f"✓ Found {data['totale']} ricette")
    
    def test_lista_ricette_with_search(self):
        """Test GET /api/haccp-v2/ricettario with search filter"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/ricettario?search=cornetto")
        assert response.status_code == 200
        
        data = response.json()
        assert "ricette" in data
        print(f"✓ Search returned {len(data['ricette'])} results for 'cornetto'")
    
    def test_dettaglio_ricetta(self):
        """Test GET /api/haccp-v2/ricettario/{id} - Dettaglio ricetta"""
        # First get a ricetta ID
        list_response = requests.get(f"{BASE_URL}/api/haccp-v2/ricettario")
        assert list_response.status_code == 200
        
        ricette = list_response.json().get("ricette", [])
        if len(ricette) > 0:
            ricetta_id = ricette[0]["id"]
            
            response = requests.get(f"{BASE_URL}/api/haccp-v2/ricettario/{ricetta_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert "id" in data
            assert "nome" in data
            assert "ingredienti" in data
            assert "food_cost" in data
            print(f"✓ Dettaglio ricetta '{data['nome']}' retrieved")
        else:
            pytest.skip("No ricette available for detail test")
    
    def test_tracciabilita_ricetta(self):
        """Test GET /api/haccp-v2/ricettario/tracciabilita/{id}"""
        # First get a ricetta ID
        list_response = requests.get(f"{BASE_URL}/api/haccp-v2/ricettario")
        assert list_response.status_code == 200
        
        ricette = list_response.json().get("ricette", [])
        if len(ricette) > 0:
            ricetta_id = ricette[0]["id"]
            
            response = requests.get(f"{BASE_URL}/api/haccp-v2/ricettario/tracciabilita/{ricetta_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert "ricetta_id" in data
            assert "ingredienti" in data
            assert "percentuale_tracciabilita" in data
            print(f"✓ Tracciabilità: {data['percentuale_tracciabilita']}%")
        else:
            pytest.skip("No ricette available for tracciabilita test")


class TestNonConformita:
    """Tests for Non Conformità HACCP API"""
    
    def test_motivi_azioni(self):
        """Test GET /api/haccp-v2/non-conformi/motivi-azioni"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/non-conformi/motivi-azioni")
        assert response.status_code == 200
        
        data = response.json()
        assert "motivi" in data
        assert "azioni" in data
        assert "operatori" in data
        
        # Verify motivi structure
        assert "SCADUTO" in data["motivi"]
        assert "TEMP_FRIGO" in data["motivi"]
        assert "CONTAMINAZIONE" in data["motivi"]
        
        # Verify azioni structure
        assert "smaltimento" in data["azioni"]
        assert "reso_fornitore" in data["azioni"]
        
        # Verify operatori
        assert len(data["operatori"]) > 0
        print(f"✓ Motivi: {len(data['motivi'])}, Azioni: {len(data['azioni'])}, Operatori: {len(data['operatori'])}")
    
    def test_lista_non_conformita(self):
        """Test GET /api/haccp-v2/non-conformi"""
        anno = datetime.now().year
        mese = datetime.now().month
        
        response = requests.get(f"{BASE_URL}/api/haccp-v2/non-conformi?anno={anno}&mese={mese}")
        assert response.status_code == 200
        
        data = response.json()
        assert "non_conformita" in data
        assert "totale" in data
        assert "per_stato" in data
        print(f"✓ Non conformità mese corrente: {data['totale']}")
    
    def test_registra_non_conformita(self):
        """Test POST /api/haccp-v2/non-conformi - Registra nuova NC"""
        payload = {
            "prodotto": "TEST_Prodotto_Test_Iteration47",
            "quantita": 1,
            "unita": "pz",
            "motivo": "SCADUTO",
            "descrizione": "Test non conformità iteration 47",
            "azione_correttiva": "smaltimento",
            "operatore": "Pocci Salvatore"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/haccp-v2/non-conformi",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "non_conformita" in data
        
        nc = data["non_conformita"]
        assert nc["prodotto"] == payload["prodotto"]
        assert nc["motivo"] == "SCADUTO"
        assert nc["stato"] == "aperto"
        assert "firma_digitale" in nc
        
        print(f"✓ Non conformità registrata: {nc['id']}")
        
        # Cleanup - delete the test NC
        nc_id = nc["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/haccp-v2/non-conformi/{nc_id}")
        assert delete_response.status_code == 200
        print(f"✓ Test NC deleted")
    
    def test_scheda_mensile_non_conformita(self):
        """Test GET /api/haccp-v2/non-conformi/scheda-mensile/{anno}/{mese}"""
        anno = datetime.now().year
        mese = datetime.now().month
        
        response = requests.get(f"{BASE_URL}/api/haccp-v2/non-conformi/scheda-mensile/{anno}/{mese}")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        assert "registrazioni" in data
        assert "statistiche" in data
        print(f"✓ Scheda mensile NC: {data['totale_registrazioni']} registrazioni")


class TestTemperaturePositive:
    """Tests for Temperature Positive (Frigoriferi) API"""
    
    def test_scheda_frigorifero(self):
        """Test GET /api/haccp-v2/temperature-positive/scheda/{anno}/{frigorifero}"""
        anno = datetime.now().year
        
        response = requests.get(f"{BASE_URL}/api/haccp-v2/temperature-positive/scheda/{anno}/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert "frigorifero_numero" in data
        assert "temperature" in data
        assert "temp_min" in data
        assert "temp_max" in data
        print(f"✓ Scheda frigorifero 1: range {data['temp_min']}°C - {data['temp_max']}°C")
    
    def test_tutte_schede_frigoriferi(self):
        """Test GET /api/haccp-v2/temperature-positive/schede/{anno}"""
        anno = datetime.now().year
        
        response = requests.get(f"{BASE_URL}/api/haccp-v2/temperature-positive/schede/{anno}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 12  # 12 frigoriferi
        print(f"✓ Retrieved {len(data)} schede frigoriferi")
    
    def test_registra_temperatura(self):
        """Test POST /api/haccp-v2/temperature-positive/scheda/{anno}/{frigorifero}/registra"""
        anno = datetime.now().year
        mese = datetime.now().month
        giorno = datetime.now().day
        
        response = requests.post(
            f"{BASE_URL}/api/haccp-v2/temperature-positive/scheda/{anno}/1/registra",
            params={
                "mese": mese,
                "giorno": giorno,
                "temperatura": 2.5,
                "operatore": "Pocci Salvatore",
                "note": "Test iteration 47"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "allarme" in data
        print(f"✓ Temperatura registrata: 2.5°C, allarme: {data['allarme']}")
    
    def test_operatori(self):
        """Test GET /api/haccp-v2/temperature-positive/operatori"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/temperature-positive/operatori")
        assert response.status_code == 200
        
        data = response.json()
        assert "operatori" in data
        assert len(data["operatori"]) > 0
        print(f"✓ Operatori: {data['operatori']}")


class TestTemperatureNegative:
    """Tests for Temperature Negative (Congelatori) API"""
    
    def test_scheda_congelatore(self):
        """Test GET /api/haccp-v2/temperature-negative/scheda/{anno}/{congelatore}"""
        anno = datetime.now().year
        
        response = requests.get(f"{BASE_URL}/api/haccp-v2/temperature-negative/scheda/{anno}/1")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert "congelatore_numero" in data or "frigorifero_numero" in data
        assert "temperature" in data
        print(f"✓ Scheda congelatore 1 retrieved")


class TestSanificazione:
    """Tests for Sanificazione API"""
    
    def test_attrezzature(self):
        """Test GET /api/haccp-v2/sanificazione/attrezzature"""
        response = requests.get(f"{BASE_URL}/api/haccp-v2/sanificazione/attrezzature")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Attrezzature: {len(data)} items")
    
    def test_scheda_mensile_sanificazione(self):
        """Test GET /api/haccp-v2/sanificazione/scheda/{anno}/{mese}"""
        anno = datetime.now().year
        mese = datetime.now().month
        
        response = requests.get(f"{BASE_URL}/api/haccp-v2/sanificazione/scheda/{anno}/{mese}")
        assert response.status_code == 200
        
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        assert "registrazioni" in data
        print(f"✓ Scheda sanificazione {mese}/{anno} retrieved")
    
    def test_registra_sanificazione(self):
        """Test POST /api/haccp-v2/sanificazione/scheda/{anno}/{mese}/registra"""
        anno = datetime.now().year
        mese = datetime.now().month
        giorno = datetime.now().day
        
        response = requests.post(
            f"{BASE_URL}/api/haccp-v2/sanificazione/scheda/{anno}/{mese}/registra",
            params={
                "giorno": giorno,
                "attrezzatura": "Pavimentazione",
                "eseguita": True,
                "operatore": "Test Operatore"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Sanificazione registrata per giorno {giorno}")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ API healthy: {data['version']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
