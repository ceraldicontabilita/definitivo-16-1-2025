"""
Post-Refactoring Test Suite
Tests all main features after the codebase cleanup to ensure nothing is broken.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pasticceria-fin.preview.emergentagent.com')

class TestHealthAndBasicAPIs:
    """Test health check and basic API endpoints"""
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✅ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test root / endpoint"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✅ Root endpoint passed: {data}")


class TestDashboardAPIs:
    """Test Dashboard related endpoints"""
    
    def test_dashboard_stats(self):
        """Test /api/dashboard/stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        # Verify expected fields
        assert "invoices" in data
        assert "suppliers" in data
        assert "employees" in data
        print(f"✅ Dashboard stats: invoices={data.get('invoices')}, suppliers={data.get('suppliers')}, employees={data.get('employees')}")
    
    def test_dashboard_summary(self):
        """Test /api/dashboard/summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Dashboard summary: {data}")
    
    def test_dashboard_trend_mensile(self):
        """Test /api/dashboard/trend-mensile endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/trend-mensile?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "trend_mensile" in data or "totali" in data
        print(f"✅ Dashboard trend mensile loaded")


class TestScadenzeAPIs:
    """Test Scadenze (Deadlines) endpoints"""
    
    def test_scadenze_prossime(self):
        """Test /api/scadenze/prossime endpoint"""
        response = requests.get(f"{BASE_URL}/api/scadenze/prossime?giorni=30&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "scadenze" in data
        assert "totale" in data
        print(f"✅ Scadenze prossime: {data.get('totale')} scadenze trovate")
    
    def test_scadenze_iva(self):
        """Test /api/scadenze/iva/{anno} endpoint"""
        response = requests.get(f"{BASE_URL}/api/scadenze/iva/2025")
        assert response.status_code == 200
        data = response.json()
        assert "scadenze" in data
        print(f"✅ Scadenze IVA 2025: {len(data.get('scadenze', []))} trimestri")
    
    def test_scadenze_tutte(self):
        """Test /api/scadenze/tutte endpoint"""
        response = requests.get(f"{BASE_URL}/api/scadenze/tutte?anno=2025&limit=20")
        assert response.status_code == 200
        data = response.json()
        assert "scadenze" in data
        print(f"✅ Scadenze tutte: {len(data.get('scadenze', []))} scadenze")


class TestFattureAPIs:
    """Test Fatture (Invoices) endpoints"""
    
    def test_fatture_list(self):
        """Test /api/invoices endpoint"""
        response = requests.get(f"{BASE_URL}/api/invoices?anno=2025&limit=10")
        assert response.status_code == 200
        data = response.json()
        # Can be list or dict with items
        if isinstance(data, list):
            print(f"✅ Fatture list: {len(data)} fatture")
        else:
            print(f"✅ Fatture list: {len(data.get('items', []))} fatture")
    
    def test_fatture_anni_disponibili(self):
        """Test /api/invoices/anni-disponibili endpoint"""
        response = requests.get(f"{BASE_URL}/api/invoices/anni-disponibili")
        assert response.status_code == 200
        data = response.json()
        assert "anni" in data
        print(f"✅ Anni disponibili: {data.get('anni')}")


class TestPrimaNotaAPIs:
    """Test Prima Nota endpoints"""
    
    def test_prima_nota_cassa(self):
        """Test /api/prima-nota/cassa endpoint"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Prima Nota Cassa: {len(data.get('movimenti', []))} movimenti")
    
    def test_prima_nota_banca(self):
        """Test /api/prima-nota/banca endpoint"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Prima Nota Banca: {len(data.get('movimenti', []))} movimenti")
    
    def test_prima_nota_riepilogo(self):
        """Test /api/prima-nota/riepilogo endpoint"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/riepilogo?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Prima Nota Riepilogo loaded")


class TestIVAAPIs:
    """Test IVA calculation endpoints"""
    
    def test_iva_today(self):
        """Test /api/iva/today endpoint"""
        response = requests.get(f"{BASE_URL}/api/iva/today")
        assert response.status_code == 200
        data = response.json()
        assert "iva_debito" in data or "data" in data
        print(f"✅ IVA today: {data}")
    
    def test_iva_annual(self):
        """Test /api/iva/annual/{anno} endpoint"""
        response = requests.get(f"{BASE_URL}/api/iva/annual/2025")
        assert response.status_code == 200
        data = response.json()
        assert "totali" in data or "monthly_data" in data
        print(f"✅ IVA annual 2025 loaded")
    
    def test_iva_monthly(self):
        """Test /api/iva/monthly/{anno}/{mese} endpoint"""
        response = requests.get(f"{BASE_URL}/api/iva/monthly/2025/1")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ IVA monthly 2025/01 loaded")


class TestDipendentiAPIs:
    """Test Dipendenti (Employees) endpoints"""
    
    def test_dipendenti_list(self):
        """Test /api/dipendenti endpoint"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Dipendenti list: {len(data)} dipendenti")
    
    def test_contract_types(self):
        """Test /api/contracts/types endpoint"""
        response = requests.get(f"{BASE_URL}/api/contracts/types")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Contract types: {len(data)} tipi")


class TestFornitoriAPIs:
    """Test Fornitori (Suppliers) endpoints"""
    
    def test_fornitori_list(self):
        """Test /api/suppliers endpoint"""
        response = requests.get(f"{BASE_URL}/api/suppliers?limit=10")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Fornitori list loaded")


class TestMagazzinoAPIs:
    """Test Magazzino (Warehouse) endpoints"""
    
    def test_magazzino_products(self):
        """Test /api/magazzino/products endpoint"""
        response = requests.get(f"{BASE_URL}/api/magazzino/products?limit=10")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Magazzino products loaded")


class TestHACCPAPIs:
    """Test HACCP endpoints"""
    
    def test_haccp_dashboard(self):
        """Test /api/haccp-completo/dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/dashboard")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ HACCP dashboard loaded")
    
    def test_haccp_notifiche(self):
        """Test /api/haccp-completo/notifiche endpoint"""
        response = requests.get(f"{BASE_URL}/api/haccp-completo/notifiche?limit=5")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ HACCP notifiche: {data.get('non_lette', 0)} non lette")


class TestBilancioAPIs:
    """Test Bilancio endpoints"""
    
    def test_bilancio_stato_patrimoniale(self):
        """Test /api/bilancio/stato-patrimoniale endpoint"""
        response = requests.get(f"{BASE_URL}/api/bilancio/stato-patrimoniale?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Bilancio stato patrimoniale loaded")
    
    def test_bilancio_conto_economico(self):
        """Test /api/bilancio/conto-economico endpoint"""
        response = requests.get(f"{BASE_URL}/api/bilancio/conto-economico?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Bilancio conto economico loaded")


class TestCorrispettiviAPIs:
    """Test Corrispettivi endpoints"""
    
    def test_corrispettivi_list(self):
        """Test /api/corrispettivi endpoint"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi?anno=2025&limit=10")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Corrispettivi list loaded")


class TestF24APIs:
    """Test F24 endpoints"""
    
    def test_f24_list(self):
        """Test /api/f24 endpoint"""
        response = requests.get(f"{BASE_URL}/api/f24?anno=2025")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ F24 list loaded")


class TestPOSAccreditoAPIs:
    """Test POS Accredito endpoints"""
    
    def test_pos_calendario(self):
        """Test /api/pos-accredito/calendario-mensile endpoint"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calendario-mensile/2025/1")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ POS calendario mensile loaded")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
