"""
Test Dipendenti Detail Modal - Iteration 41
Tests for employee detail modal with tabs: Anagrafica, Retribuzione, Progressivi, Agevolazioni, Contratti
Focus on saving new fields: paga_base, contingenza, progressivi
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDipendentiAPI:
    """Test dipendenti CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_prefix = "TEST_ITER41_"
        self.created_ids = []
        yield
        # Cleanup
        for dip_id in self.created_ids:
            try:
                requests.delete(f"{BASE_URL}/api/dipendenti/{dip_id}")
            except:
                pass
    
    def test_01_list_dipendenti(self):
        """Test GET /api/dipendenti - list all employees"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} dipendenti")
        
        # Check if at least one employee exists
        if len(data) > 0:
            emp = data[0]
            assert "id" in emp, "Employee should have id"
            assert "nome_completo" in emp or "nome" in emp, "Employee should have name"
    
    def test_02_get_dipendente_detail(self):
        """Test GET /api/dipendenti/{id} - get single employee"""
        # First get list to find an employee
        list_response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert list_response.status_code == 200
        
        dipendenti = list_response.json()
        if len(dipendenti) == 0:
            pytest.skip("No employees found to test")
        
        emp_id = dipendenti[0]["id"]
        
        # Get detail
        response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == emp_id, "ID should match"
        print(f"Got employee: {data.get('nome_completo', data.get('nome'))}")
    
    def test_03_create_dipendente_with_retribuzione(self):
        """Test POST /api/dipendenti - create employee with paga_base, contingenza"""
        test_name = f"{self.test_prefix}Mario Rossi"
        
        payload = {
            "nome_completo": test_name,
            "codice_fiscale": f"RSSMRA{uuid.uuid4().hex[:10].upper()}",
            "email": "test.mario@example.com",
            "telefono": "3331234567",
            "mansione": "Cameriere",
            "livello": "4",
            "tipo_contratto": "Tempo Indeterminato",
            "paga_base": 1200.50,
            "contingenza": 520.30,
            "stipendio_lordo": 1720.80,
            "stipendio_orario": 10.50,
            "ore_settimanali": 40
        }
        
        response = requests.post(f"{BASE_URL}/api/dipendenti", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_ids.append(data["id"])
        
        # Verify fields
        assert data["nome_completo"] == test_name
        assert data["paga_base"] == 1200.50, f"paga_base should be 1200.50, got {data.get('paga_base')}"
        assert data["contingenza"] == 520.30, f"contingenza should be 520.30, got {data.get('contingenza')}"
        print(f"Created employee with paga_base={data['paga_base']}, contingenza={data['contingenza']}")
    
    def test_04_update_retribuzione_fields(self):
        """Test PUT /api/dipendenti/{id} - update paga_base and contingenza"""
        # Create test employee first
        test_name = f"{self.test_prefix}Luigi Verdi"
        create_payload = {
            "nome_completo": test_name,
            "paga_base": 1000,
            "contingenza": 400
        }
        
        create_response = requests.post(f"{BASE_URL}/api/dipendenti", json=create_payload)
        assert create_response.status_code == 200
        emp_id = create_response.json()["id"]
        self.created_ids.append(emp_id)
        
        # Update retribuzione
        update_payload = {
            "paga_base": 1350.75,
            "contingenza": 530.00,
            "stipendio_lordo": 1880.75
        }
        
        update_response = requests.put(f"{BASE_URL}/api/dipendenti/{emp_id}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["paga_base"] == 1350.75, f"paga_base should be 1350.75, got {data.get('paga_base')}"
        assert data["contingenza"] == 530.00, f"contingenza should be 530.00, got {data.get('contingenza')}"
        print(f"Updated retribuzione: paga_base={data['paga_base']}, contingenza={data['contingenza']}")
    
    def test_05_update_progressivi_fields(self):
        """Test PUT /api/dipendenti/{id} - update progressivi (TFR, ferie, permessi)"""
        # Create test employee
        test_name = f"{self.test_prefix}Anna Bianchi"
        create_payload = {"nome_completo": test_name}
        
        create_response = requests.post(f"{BASE_URL}/api/dipendenti", json=create_payload)
        assert create_response.status_code == 200
        emp_id = create_response.json()["id"]
        self.created_ids.append(emp_id)
        
        # Update progressivi
        update_payload = {
            "progressivi": {
                "tfr_accantonato": 5800.50,
                "ferie_maturate": 160,
                "ferie_godute": 80,
                "ferie_residue": 80,
                "permessi_maturati": 40,
                "permessi_goduti": 20,
                "permessi_residui": 20,
                "rol_maturati": 32,
                "rol_goduti": 16,
                "rol_residui": 16
            }
        }
        
        update_response = requests.put(f"{BASE_URL}/api/dipendenti/{emp_id}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        progressivi = data.get("progressivi", {})
        
        assert progressivi.get("tfr_accantonato") == 5800.50, f"tfr_accantonato should be 5800.50, got {progressivi.get('tfr_accantonato')}"
        assert progressivi.get("ferie_maturate") == 160, f"ferie_maturate should be 160, got {progressivi.get('ferie_maturate')}"
        assert progressivi.get("ferie_residue") == 80, f"ferie_residue should be 80, got {progressivi.get('ferie_residue')}"
        print(f"Updated progressivi: tfr={progressivi.get('tfr_accantonato')}, ferie_residue={progressivi.get('ferie_residue')}")
    
    def test_06_update_agevolazioni(self):
        """Test PUT /api/dipendenti/{id} - update agevolazioni array"""
        # Create test employee
        test_name = f"{self.test_prefix}Paolo Neri"
        create_payload = {"nome_completo": test_name}
        
        create_response = requests.post(f"{BASE_URL}/api/dipendenti", json=create_payload)
        assert create_response.status_code == 200
        emp_id = create_response.json()["id"]
        self.created_ids.append(emp_id)
        
        # Update agevolazioni
        update_payload = {
            "agevolazioni": [
                "Decontr.SUD DL104.20",
                "Bonus Under 36"
            ]
        }
        
        update_response = requests.put(f"{BASE_URL}/api/dipendenti/{emp_id}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        agevolazioni = data.get("agevolazioni", [])
        
        assert len(agevolazioni) == 2, f"Should have 2 agevolazioni, got {len(agevolazioni)}"
        assert "Decontr.SUD DL104.20" in agevolazioni
        print(f"Updated agevolazioni: {agevolazioni}")
    
    def test_07_full_employee_update(self):
        """Test PUT /api/dipendenti/{id} - full update with all new fields"""
        # Create test employee
        test_name = f"{self.test_prefix}Complete Test"
        create_payload = {"nome_completo": test_name}
        
        create_response = requests.post(f"{BASE_URL}/api/dipendenti", json=create_payload)
        assert create_response.status_code == 200
        emp_id = create_response.json()["id"]
        self.created_ids.append(emp_id)
        
        # Full update
        update_payload = {
            "nome": "Complete",
            "cognome": "Test",
            "codice_dipendente": "0300099",
            "mansione": "CAM. DI SALA",
            "qualifica": "OPE",
            "livello": "6S",
            "tipo_contratto": "Tempo Indeterminato",
            "paga_base": 1450.00,
            "contingenza": 550.00,
            "stipendio_lordo": 2000.00,
            "stipendio_orario": 12.50,
            "ore_settimanali": 40,
            "progressivi": {
                "tfr_accantonato": 6500.00,
                "ferie_maturate": 200,
                "ferie_godute": 100,
                "ferie_residue": 100,
                "permessi_maturati": 50,
                "permessi_goduti": 25,
                "permessi_residui": 25,
                "rol_maturati": 40,
                "rol_goduti": 20,
                "rol_residui": 20
            },
            "agevolazioni": ["Decontr.SUD DL104.20"]
        }
        
        update_response = requests.put(f"{BASE_URL}/api/dipendenti/{emp_id}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify all fields persisted
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        
        # Verify retribuzione
        assert data.get("paga_base") == 1450.00
        assert data.get("contingenza") == 550.00
        assert data.get("stipendio_lordo") == 2000.00
        
        # Verify progressivi
        progressivi = data.get("progressivi", {})
        assert progressivi.get("tfr_accantonato") == 6500.00
        assert progressivi.get("ferie_residue") == 100
        
        # Verify agevolazioni
        assert "Decontr.SUD DL104.20" in data.get("agevolazioni", [])
        
        print("Full employee update verified successfully")
    
    def test_08_delete_dipendente(self):
        """Test DELETE /api/dipendenti/{id}"""
        # Create test employee
        test_name = f"{self.test_prefix}ToDelete"
        create_payload = {"nome_completo": test_name}
        
        create_response = requests.post(f"{BASE_URL}/api/dipendenti", json=create_payload)
        assert create_response.status_code == 200
        emp_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert get_response.status_code == 404, "Employee should be deleted"
        print("Employee deleted successfully")


class TestDipendentiStats:
    """Test dipendenti statistics endpoints"""
    
    def test_get_stats(self):
        """Test GET /api/dipendenti/stats"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totale" in data, "Stats should have totale"
        assert "attivi" in data, "Stats should have attivi"
        print(f"Stats: totale={data['totale']}, attivi={data['attivi']}")
    
    def test_get_mansioni(self):
        """Test GET /api/dipendenti/mansioni"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/mansioni")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Mansioni should be a list"
        print(f"Available mansioni: {data[:5]}...")
    
    def test_get_tipi_contratto(self):
        """Test GET /api/dipendenti/tipi-contratto"""
        response = requests.get(f"{BASE_URL}/api/dipendenti/tipi-contratto")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Tipi contratto should be a list"
        print(f"Available contract types: {data}")


class TestExistingEmployeeUpdate:
    """Test updating existing employee with new fields"""
    
    def test_update_existing_employee_retribuzione(self):
        """Test updating an existing employee's retribuzione fields"""
        # Get first employee
        list_response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert list_response.status_code == 200
        
        dipendenti = list_response.json()
        if len(dipendenti) == 0:
            pytest.skip("No employees found")
        
        # Find employee without TEST_ prefix
        emp = None
        for d in dipendenti:
            name = d.get("nome_completo", d.get("nome", ""))
            if not name.startswith("TEST_"):
                emp = d
                break
        
        if not emp:
            pytest.skip("No non-test employees found")
        
        emp_id = emp["id"]
        original_paga_base = emp.get("paga_base", 0)
        
        # Update with new paga_base
        new_paga_base = 1500.00
        update_payload = {"paga_base": new_paga_base}
        
        update_response = requests.put(f"{BASE_URL}/api/dipendenti/{emp_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/dipendenti/{emp_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data.get("paga_base") == new_paga_base
        
        # Restore original value
        restore_payload = {"paga_base": original_paga_base}
        requests.put(f"{BASE_URL}/api/dipendenti/{emp_id}", json=restore_payload)
        
        print(f"Successfully updated and restored paga_base for {emp.get('nome_completo')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
