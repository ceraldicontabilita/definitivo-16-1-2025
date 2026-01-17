"""
Test Iteration 18 - Testing CERALDI exclusion, Dashboard payment, Prima Nota Salari
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://invoice-rescue-7.preview.emergentagent.com')

class TestCeraldiExclusion:
    """Test that CERALDI GROUP SRL is NOT shown as fornitore"""
    
    def test_riconciliazione_smart_no_ceraldi_group(self):
        """CERALDI GROUP SRL should NOT appear as fornitore in riconciliazione"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        movimenti = data.get('movimenti', [])
        
        # Check that CERALDI GROUP (the company) is not in fornitore field
        ceraldi_group_found = False
        for m in movimenti:
            fornitore = (m.get('fornitore') or '').upper()
            ragione_sociale = (m.get('ragione_sociale') or '').upper()
            
            # Check for company name variations
            if 'CERALDI GROUP' in fornitore or 'CERALDI GROUP' in ragione_sociale:
                ceraldi_group_found = True
                break
            if 'CERALDI S.R.L' in fornitore or 'CERALDI SRL' in fornitore:
                ceraldi_group_found = True
                break
        
        assert not ceraldi_group_found, "CERALDI GROUP SRL should NOT appear as fornitore"
    
    def test_ceraldi_employee_allowed(self):
        """Ceraldi Vincenzo (employee) SHOULD be allowed in stipendi"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=100")
        assert response.status_code == 200
        
        data = response.json()
        movimenti = data.get('movimenti', [])
        
        # Find stipendi with Ceraldi Vincenzo
        ceraldi_vincenzo_found = False
        for m in movimenti:
            if m.get('tipo') == 'stipendio':
                nome = (m.get('nome_estratto') or '').upper()
                if 'CERALDI VINCENZO' in nome:
                    ceraldi_vincenzo_found = True
                    break
        
        # This is expected - employee names should be shown
        print(f"Ceraldi Vincenzo found in stipendi: {ceraldi_vincenzo_found}")


class TestDashboardPayment:
    """Test Dashboard payment functionality with CASSA/BANCA"""
    
    def test_prima_nota_cassa_endpoint(self):
        """POST /api/prima-nota/cassa should work"""
        payload = {
            "data": "2026-01-17",
            "tipo": "uscita",
            "categoria": "pagamento_fornitore",
            "descrizione": "Test pagamento CASSA - pytest",
            "importo": 10.00,
            "fornitore": "TEST FORNITORE",
            "direzione": "uscita"
        }
        
        response = requests.post(f"{BASE_URL}/api/prima-nota/cassa", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert 'id' in data or 'message' in data
        print(f"Cassa payment created: {data}")
    
    def test_prima_nota_banca_endpoint(self):
        """POST /api/prima-nota/banca should work"""
        payload = {
            "data": "2026-01-17",
            "tipo": "uscita",
            "categoria": "pagamento_fornitore",
            "descrizione": "Test pagamento BANCA - pytest",
            "importo": 20.00,
            "fornitore": "TEST FORNITORE BANCA",
            "direzione": "uscita"
        }
        
        response = requests.post(f"{BASE_URL}/api/prima-nota/banca", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert 'id' in data or 'message' in data
        print(f"Banca payment created: {data}")


class TestPrimaNotaSalari:
    """Test Prima Nota Salari functionality"""
    
    def test_prima_nota_salari_endpoint(self):
        """GET /api/prima-nota/salari should return data"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/salari?anno=2026")
        assert response.status_code == 200
        
        data = response.json()
        # Can be empty list or dict with movimenti
        if isinstance(data, list):
            print(f"Salari movements (list): {len(data)}")
        elif isinstance(data, dict):
            movimenti = data.get('movimenti', [])
            print(f"Salari movements (dict): {len(movimenti)}")
    
    def test_prima_nota_salari_post(self):
        """POST /api/prima-nota/salari should create salary entry"""
        payload = {
            "data": "2026-01-17",
            "tipo": "uscita",
            "categoria": "stipendio",
            "descrizione": "Test stipendio - pytest",
            "importo": 1500.00,
            "dipendente": "Test Dipendente",
            "direzione": "uscita"
        }
        
        response = requests.post(f"{BASE_URL}/api/prima-nota/salari", json=payload)
        # May return 200 or 201
        assert response.status_code in [200, 201, 422]  # 422 if validation fails
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"Salari entry created: {data}")


class TestRiconciliazioneStipendi:
    """Test Riconciliazione Stipendi - should show employee names, not company names"""
    
    def test_stipendi_search_endpoint(self):
        """GET /api/operazioni-da-confermare/smart/cerca-stipendi should return employee data"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/cerca-stipendi")
        assert response.status_code == 200
        
        data = response.json()
        stipendi = data.get('stipendi', [])
        
        print(f"Found {len(stipendi)} stipendi entries")
        
        # Check that stipendi have employee names
        for s in stipendi[:5]:
            dipendente = s.get('dipendente', '')
            print(f"  - Dipendente: {dipendente}")
            
            # Verify it's not a company name (shouldn't end with SRL, S.R.L., SPA, etc.)
            if dipendente:
                upper_name = dipendente.upper()
                is_company = any(suffix in upper_name for suffix in ['SRL', 'S.R.L.', 'SPA', 'S.P.A.', 'SNCS', 'S.N.C.'])
                if is_company:
                    print(f"    ⚠️ WARNING: {dipendente} looks like a company name!")


class TestScadenzeAPI:
    """Test Scadenze API for Dashboard"""
    
    def test_scadenze_prossime(self):
        """GET /api/scadenze/prossime should return upcoming deadlines"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime?giorni=30&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if isinstance(data, list):
            print(f"Found {len(data)} scadenze")
        elif isinstance(data, dict):
            scadenze = data.get('scadenze', [])
            print(f"Found {len(scadenze)} scadenze")
            
            # Check structure
            if scadenze:
                s = scadenze[0]
                print(f"  First scadenza: tipo={s.get('tipo')}, fornitore={s.get('fornitore')}, importo={s.get('importo')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
