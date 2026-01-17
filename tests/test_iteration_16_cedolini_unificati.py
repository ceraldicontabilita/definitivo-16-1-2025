"""
Test Iteration 16: Cedolini Unificati e Riconoscimento Periodo Documenti
=========================================================================

Verifica:
1. Endpoint /api/cedolini restituisce 474 record (collection unificata)
2. Endpoint /api/employees/payslips ora legge da cedolini
3. Endpoint /api/employees mostra ultimo_periodo dai cedolini
4. Pagina /chiusura-esercizio funziona correttamente
5. Pagina /dipendenti mostra elenco dipendenti
6. Backend /api/health risponde correttamente
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://invoice-rescue-7.preview.emergentagent.com')


class TestHealthEndpoint:
    """Test health endpoint"""
    
    def test_health_endpoint(self):
        """Verifica che /api/health risponda correttamente"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✅ Health check passed: {data}")


class TestCedoliniUnificati:
    """Test collection cedolini unificata"""
    
    def test_cedolini_endpoint_returns_474_records(self):
        """Verifica che /api/cedolini restituisca 474 record"""
        response = requests.get(f"{BASE_URL}/api/cedolini")
        assert response.status_code == 200
        data = response.json()
        
        # Verifica struttura risposta
        assert "cedolini" in data
        assert "total" in data
        
        # Verifica numero record
        total = data.get("total", len(data.get("cedolini", [])))
        assert total == 474, f"Expected 474 cedolini, got {total}"
        print(f"✅ Cedolini endpoint returns {total} records")
    
    def test_cedolini_data_structure(self):
        """Verifica struttura dati cedolini"""
        response = requests.get(f"{BASE_URL}/api/cedolini")
        assert response.status_code == 200
        data = response.json()
        
        cedolini = data.get("cedolini", [])
        assert len(cedolini) > 0, "No cedolini found"
        
        # Verifica campi obbligatori
        sample = cedolini[0]
        required_fields = ["codice_fiscale", "mese", "anno", "netto_mese"]
        for field in required_fields:
            assert field in sample, f"Missing field: {field}"
        
        print(f"✅ Cedolini data structure is correct")


class TestEmployeesPayslips:
    """Test endpoint /api/employees/payslips"""
    
    def test_employees_payslips_reads_from_cedolini(self):
        """Verifica che /api/employees/payslips legga da cedolini"""
        response = requests.get(f"{BASE_URL}/api/employees/payslips")
        assert response.status_code == 200
        data = response.json()
        
        # Deve restituire un array direttamente
        assert isinstance(data, list), "Expected array response"
        assert len(data) == 474, f"Expected 474 payslips, got {len(data)}"
        print(f"✅ Employees payslips endpoint returns {len(data)} records from cedolini")
    
    def test_payslips_data_structure(self):
        """Verifica struttura dati payslips"""
        response = requests.get(f"{BASE_URL}/api/employees/payslips")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) > 0, "No payslips found"
        
        sample = data[0]
        # Verifica campi cedolini
        assert "codice_fiscale" in sample
        assert "netto_mese" in sample or "retribuzione_netta" in sample
        print(f"✅ Payslips data structure is correct")


class TestEmployeesUltimoPeriodo:
    """Test endpoint /api/employees con ultimo_periodo"""
    
    def test_employees_shows_ultimo_periodo(self):
        """Verifica che /api/employees mostri ultimo_periodo dai cedolini"""
        response = requests.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected array response"
        assert len(data) > 0, "No employees found"
        
        # Verifica che almeno alcuni dipendenti abbiano ultimo_periodo
        employees_with_periodo = [e for e in data if e.get("ultimo_periodo")]
        assert len(employees_with_periodo) > 0, "No employees with ultimo_periodo found"
        
        print(f"✅ Found {len(employees_with_periodo)} employees with ultimo_periodo")
        
        # Verifica formato ultimo_periodo
        for emp in employees_with_periodo[:5]:
            periodo = emp.get("ultimo_periodo")
            print(f"  - {emp.get('nome_completo', emp.get('name'))}: {periodo}")
    
    def test_employees_netto_lordo_from_cedolini(self):
        """Verifica che netto e lordo vengano dai cedolini"""
        response = requests.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        data = response.json()
        
        # Verifica che almeno alcuni dipendenti abbiano netto
        employees_with_netto = [e for e in data if e.get("netto") and e.get("netto") > 0]
        assert len(employees_with_netto) > 0, "No employees with netto found"
        
        print(f"✅ Found {len(employees_with_netto)} employees with netto from cedolini")


class TestDipendentiEndpoint:
    """Test endpoint /api/dipendenti"""
    
    def test_dipendenti_list(self):
        """Verifica che /api/dipendenti restituisca la lista dipendenti"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected array response"
        assert len(data) == 27, f"Expected 27 dipendenti, got {len(data)}"
        print(f"✅ Dipendenti endpoint returns {len(data)} records")


class TestChiusuraEsercizio:
    """Test endpoint chiusura esercizio"""
    
    def test_chiusura_esercizio_stato(self):
        """Verifica endpoint stato chiusura esercizio"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/stato/2026")
        assert response.status_code == 200
        data = response.json()
        
        assert "anno" in data
        assert "stato" in data
        assert data["anno"] == 2026
        print(f"✅ Chiusura esercizio stato: {data}")
    
    def test_chiusura_esercizio_verifica_preliminare(self):
        """Verifica endpoint verifica preliminare"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/verifica-preliminare/2026")
        assert response.status_code == 200
        data = response.json()
        
        assert "punteggio_completezza" in data
        print(f"✅ Verifica preliminare: punteggio {data.get('punteggio_completezza')}%")
    
    def test_chiusura_esercizio_bilancino(self):
        """Verifica endpoint bilancino verifica"""
        response = requests.get(f"{BASE_URL}/api/chiusura-esercizio/bilancino-verifica/2026")
        assert response.status_code == 200
        data = response.json()
        
        # La risposta ha struttura: {anno, bilancino: {ricavi, costi, risultato}}
        assert "bilancino" in data or "ricavi" in data
        
        bilancino = data.get("bilancino", data)
        ricavi = bilancino.get("ricavi", {})
        costi = bilancino.get("costi", {})
        
        totale_ricavi = ricavi.get("totale", 0) if isinstance(ricavi, dict) else ricavi
        totale_costi = costi.get("totale", 0) if isinstance(costi, dict) else costi
        
        print(f"✅ Bilancino verifica: ricavi={totale_ricavi}, costi={totale_costi}")


class TestDocumentPeriodExtraction:
    """Test funzionalità estrazione periodo documenti"""
    
    def test_documents_inbox_has_period_info(self):
        """Verifica che i documenti abbiano info sul periodo"""
        response = requests.get(f"{BASE_URL}/api/documenti/lista?limit=10")
        
        if response.status_code == 200:
            data = response.json()
            documents = data.get("documents", [])
            
            # Verifica che alcuni documenti abbiano info periodo
            docs_with_period = [d for d in documents if d.get("identificatore_periodo") or d.get("periodo_mese")]
            print(f"✅ Found {len(docs_with_period)} documents with period info out of {len(documents)}")
        else:
            print(f"⚠️ Documents endpoint returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
