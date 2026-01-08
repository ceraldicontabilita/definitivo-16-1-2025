"""
Test suite for HACCP, Dipendenti, and Prima Nota Automation modules.
Tests all new endpoints added for the ERP application.
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://account-tracker-62.preview.emergentagent.com').rstrip('/')


class TestHACCPDashboard:
    """HACCP Dashboard endpoint tests"""
    
    def test_haccp_dashboard_loads(self):
        """Test HACCP dashboard returns stats"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "moduli_attivi" in data
        assert "conformita_percentuale" in data
        assert "scadenze_imminenti" in data
        assert "temperature_registrate_mese" in data
        assert "sanificazioni_mese" in data
        
        # Verify data types
        assert isinstance(data["moduli_attivi"], int)
        assert isinstance(data["conformita_percentuale"], (int, float))


class TestHACCPEquipaggiamenti:
    """HACCP Equipaggiamenti endpoint tests"""
    
    def test_list_equipaggiamenti(self):
        """Test listing equipaggiamenti returns frigoriferi and congelatori"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/equipaggiamenti")
        assert response.status_code == 200
        
        data = response.json()
        assert "frigoriferi" in data
        assert "congelatori" in data
        assert isinstance(data["frigoriferi"], list)
        assert isinstance(data["congelatori"], list)
        
        # Should have default equipment
        assert len(data["frigoriferi"]) > 0 or len(data["congelatori"]) > 0


class TestHACCPTemperatureFrigoriferi:
    """HACCP Temperature Frigoriferi endpoint tests"""
    
    def test_list_temperature_frigoriferi(self):
        """Test listing temperature frigoriferi for current month"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.get(f"{BASE_URL}/api/haccp-completo/temperature/frigoriferi?mese={current_month}")
        assert response.status_code == 200
        
        data = response.json()
        assert "mese" in data
        assert "records" in data
        assert "frigoriferi" in data
        assert "count" in data
        assert data["mese"] == current_month
    
    def test_genera_mese_frigoriferi(self):
        """Test generating month data for frigoriferi"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/temperature/frigoriferi/genera-mese",
            json={"mese": current_month}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "created" in data
    
    def test_create_temperatura_frigo(self):
        """Test creating a temperature record"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/temperature/frigoriferi",
            json={
                "data": today,
                "ora": "10:00",
                "equipaggiamento": "Frigo Cucina",
                "temperatura": 3.5,
                "operatore": "VALERIO",
                "note": "TEST_record"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["temperatura"] == 3.5
        assert data["conforme"] == True  # 3.5 is within 0-4 range
    
    def test_autocompila_oggi_frigo(self):
        """Test auto-filling today's temperatures"""
        response = requests.post(f"{BASE_URL}/api/haccp-completo/temperature/frigoriferi/autocompila-oggi")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "updated" in data


class TestHACCPTemperaturaCongelatori:
    """HACCP Temperature Congelatori endpoint tests"""
    
    def test_list_temperature_congelatori(self):
        """Test listing temperature congelatori for current month"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.get(f"{BASE_URL}/api/haccp-completo/temperature/congelatori?mese={current_month}")
        assert response.status_code == 200
        
        data = response.json()
        assert "mese" in data
        assert "records" in data
        assert "congelatori" in data
        assert "count" in data
    
    def test_genera_mese_congelatori(self):
        """Test generating month data for congelatori"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/temperature/congelatori/genera-mese",
            json={"mese": current_month}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "created" in data
    
    def test_create_temperatura_congelatore(self):
        """Test creating a congelatore temperature record"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/temperature/congelatori",
            json={
                "data": today,
                "ora": "10:00",
                "equipaggiamento": "Congelatore Cucina",
                "temperatura": -20,
                "operatore": "VINCENZO",
                "note": "TEST_record"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["temperatura"] == -20
        assert data["conforme"] == True  # -20 is within -22 to -18 range


class TestHACCPSanificazioni:
    """HACCP Sanificazioni endpoint tests"""
    
    def test_list_sanificazioni(self):
        """Test listing sanificazioni for current month"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.get(f"{BASE_URL}/api/haccp-completo/sanificazioni?mese={current_month}")
        assert response.status_code == 200
        
        data = response.json()
        assert "mese" in data
        assert "records" in data
        assert "aree" in data
        assert "count" in data
    
    def test_create_sanificazione(self):
        """Test creating a sanificazione record"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/sanificazioni",
            json={
                "data": today,
                "ora": "08:00",
                "area": "Cucina",
                "operatore": "POCCI",
                "prodotto_utilizzato": "Detergente professionale",
                "esito": "OK",
                "note": "TEST_sanificazione"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["area"] == "Cucina"
        assert data["esito"] == "OK"
    
    def test_genera_mese_sanificazioni(self):
        """Test generating month data for sanificazioni"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/sanificazioni/genera-mese",
            json={"mese": current_month}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "created" in data


class TestHACCPScadenzario:
    """HACCP Scadenzario endpoint tests"""
    
    def test_list_scadenzario(self):
        """Test listing scadenzario products"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/scadenzario?days=30&mostra_scaduti=true")
        assert response.status_code == 200
        
        data = response.json()
        assert "records" in data
        assert "count" in data
        assert "scaduti" in data
    
    def test_create_scadenza(self):
        """Test creating a scadenzario product"""
        future_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/haccp-completo/scadenzario",
            json={
                "prodotto": "TEST_Mozzarella",
                "lotto": "LOT123",
                "data_scadenza": future_date,
                "quantita": 5,
                "unita": "kg",
                "fornitore": "Test Fornitore",
                "posizione": "Frigo Cucina"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["prodotto"] == "TEST_Mozzarella"
        assert data["consumato"] == False
        
        # Cleanup - mark as consumed
        product_id = data["id"]
        requests.put(f"{BASE_URL}/api/haccp-completo/scadenzario/{product_id}/consumato")


class TestDipendenti:
    """Dipendenti (Employees) endpoint tests"""
    
    def test_list_dipendenti(self):
        """Test listing dipendenti"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_dipendenti_stats(self):
        """Test getting dipendenti statistics"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "totale" in data
        assert "attivi" in data
        assert "inattivi" in data
        assert "per_mansione" in data
    
    def test_get_tipi_turno(self):
        """Test getting turno types"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/tipi-turno")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        assert "mattina" in data or len(data) > 0
    
    def test_get_mansioni(self):
        """Test getting mansioni list"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/mansioni")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_get_tipi_contratto(self):
        """Test getting contract types"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/tipi-contratto")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_create_and_delete_dipendente(self):
        """Test creating and deleting a dipendente"""
        # Create
        response = requests.post(
            f"{BASE_URL}/api/dipendenti",
            json={
                "nome_completo": "TEST_Rossi Mario",
                "codice_fiscale": "RSSMRA90A01H501Z",
                "email": "test.mario@example.com",
                "telefono": "3331234567",
                "mansione": "Cameriere",
                "tipo_contratto": "Tempo Indeterminato",
                "ore_settimanali": 40
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["nome_completo"] == "TEST_Rossi Mario"
        
        dipendente_id = data["id"]
        
        # Get to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{dipendente_id}")
        assert get_response.status_code == 200
        assert get_response.json()["nome_completo"] == "TEST_Rossi Mario"
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/dipendenti/{dipendente_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/dipendenti/{dipendente_id}")
        assert verify_response.status_code == 404


class TestPrimaNotaAutomation:
    """Prima Nota Automation endpoint tests"""
    
    def test_get_automation_stats(self):
        """Test getting automation statistics"""
        response = requests.get(f"{BASE_URL}/api/prima-nota-auto/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "fatture" in data or "prima_nota" in data or "assegni" in data
    
    def test_process_existing_invoices(self):
        """Test processing existing invoices"""
        response = requests.post(
            f"{BASE_URL}/api/prima-nota-auto/process-existing-invoices",
            json={
                "year_filter": 2025,
                "auto_move_to_prima_nota": False  # Don't actually move, just test
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data
        assert "processed" in data


class TestPrimaNota:
    """Prima Nota (Cash/Bank) endpoint tests"""
    
    def test_get_prima_nota_cassa(self):
        """Test getting prima nota cassa"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa")
        assert response.status_code == 200
        
        data = response.json()
        assert "movimenti" in data
        assert "saldo" in data
    
    def test_get_prima_nota_banca(self):
        """Test getting prima nota banca"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca")
        assert response.status_code == 200
        
        data = response.json()
        assert "movimenti" in data
        assert "saldo" in data
    
    def test_get_prima_nota_stats(self):
        """Test getting prima nota statistics"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "cassa" in data or "banca" in data or "totale" in data
    
    def test_create_movimento_cassa(self):
        """Test creating a cassa movement"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/prima-nota/cassa",
            json={
                "data": today,
                "tipo": "entrata",
                "importo": 100.50,
                "descrizione": "TEST_Incasso cliente",
                "categoria": "Incasso cliente",
                "riferimento": "TEST123",
                "note": "Test movement"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "message" in data
        
        # Cleanup
        mov_id = data["id"]
        requests.delete(f"{BASE_URL}/api/prima-nota/cassa/{mov_id}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
