"""
Test suite for ERP Azienda Semplice - Bug fixes and new features
Tests: Commercialista PDF/Email, Riconciliazione, Prima Nota movimento, Estratto Conto parser
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://invoice-flow-64.preview.emergentagent.com')


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✅ Health check passed: {data}")


class TestCommercialistaAPI:
    """Tests for Commercialista page APIs"""
    
    def test_commercialista_config(self):
        """Test commercialista config endpoint"""
        response = requests.get(f"{BASE_URL}/api/commercialista/config")
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "nome" in data
        assert "smtp_configured" in data
        print(f"✅ Commercialista config: {data}")
    
    def test_commercialista_prima_nota_cassa(self):
        """Test prima nota cassa data for commercialista"""
        response = requests.get(f"{BASE_URL}/api/commercialista/prima-nota-cassa/2025/1")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        assert "movimenti" in data
        assert "totale_entrate" in data
        assert "totale_uscite" in data
        print(f"✅ Prima Nota Cassa: {data['totale_movimenti']} movimenti, saldo: {data['saldo']}")
    
    def test_commercialista_fatture_cassa(self):
        """Test fatture cassa data for commercialista"""
        response = requests.get(f"{BASE_URL}/api/commercialista/fatture-cassa/2025/1")
        assert response.status_code == 200
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        assert "fatture" in data
        assert "totale_fatture" in data
        print(f"✅ Fatture Cassa: {data['totale_fatture']} fatture, totale: {data['totale_importo']}")
    
    def test_commercialista_alert_status(self):
        """Test alert status endpoint"""
        response = requests.get(f"{BASE_URL}/api/commercialista/alert-status")
        assert response.status_code == 200
        data = response.json()
        assert "show_alert" in data
        print(f"✅ Alert status: show_alert={data['show_alert']}")
    
    def test_commercialista_log(self):
        """Test log endpoint"""
        response = requests.get(f"{BASE_URL}/api/commercialista/log?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "log" in data
        print(f"✅ Log entries: {len(data['log'])}")


class TestPrimaNotaAPI:
    """Tests for Prima Nota APIs"""
    
    def test_prima_nota_cassa_list(self):
        """Test prima nota cassa list endpoint"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "movimenti" in data
        assert "saldo" in data
        assert "totale_entrate" in data
        assert "totale_uscite" in data
        print(f"✅ Prima Nota Cassa: {data['count']} movimenti")
    
    def test_prima_nota_banca_list(self):
        """Test prima nota banca list endpoint"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "movimenti" in data
        assert "saldo" in data
        print(f"✅ Prima Nota Banca: {data['count']} movimenti")
    
    def test_prima_nota_movimento_create(self):
        """Test creating a generic movimento via /movimento endpoint"""
        payload = {
            "data": "2025-01-15",
            "importo": 150.00,
            "descrizione": "Test movimento from pytest",
            "tipo": "banca",
            "tipo_movimento": "entrata",
            "categoria": "Test"
        }
        response = requests.post(f"{BASE_URL}/api/prima-nota/movimento", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "id" in data
        print(f"✅ Movimento created: {data['id']}")
        return data['id']
    
    def test_prima_nota_stats(self):
        """Test prima nota stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/stats")
        assert response.status_code == 200
        data = response.json()
        assert "cassa" in data
        assert "banca" in data
        assert "totale" in data
        print(f"✅ Stats: Cassa saldo={data['cassa']['saldo']}, Banca saldo={data['banca']['saldo']}")


class TestEstrattoContoParser:
    """Tests for Estratto Conto PDF parser"""
    
    def test_estratto_conto_preview(self):
        """Test estratto conto preview/info endpoint"""
        response = requests.get(f"{BASE_URL}/api/estratto-conto/preview")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "supported_banks" in data
        assert "BANCO BPM" in data["supported_banks"]
        print(f"✅ Estratto Conto preview: {data}")
    
    def test_estratto_conto_parse_pdf(self):
        """Test parsing a PDF file (if available)"""
        pdf_path = "/tmp/estratto_q2_2025.pdf"
        if os.path.exists(pdf_path):
            with open(pdf_path, 'rb') as f:
                files = {'file': ('estratto_q2_2025.pdf', f, 'application/pdf')}
                response = requests.post(f"{BASE_URL}/api/estratto-conto/parse", files=files)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert "data" in data
            assert "movimenti" in data["data"]
            print(f"✅ PDF parsed: {len(data['data']['movimenti'])} movimenti trovati")
            print(f"   Banca: {data['data']['banca']}")
            print(f"   Intestatario: {data['data']['intestatario']}")
            print(f"   Saldo iniziale: {data['data']['saldo_iniziale']}")
            print(f"   Saldo finale: {data['data']['saldo_finale']}")
        else:
            pytest.skip("Test PDF file not found at /tmp/estratto_q2_2025.pdf")


class TestRiconciliazioneAPI:
    """Tests for Riconciliazione APIs"""
    
    def test_bank_statement_stats(self):
        """Test bank statement stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/bank-statement/stats")
        assert response.status_code == 200
        data = response.json()
        assert "movimenti_banca_totali" in data
        assert "movimenti_riconciliati" in data
        assert "movimenti_non_riconciliati" in data
        assert "percentuale_riconciliazione" in data
        print(f"✅ Riconciliazione stats: {data['percentuale_riconciliazione']}% riconciliato")


class TestAssegniAPI:
    """Tests for Assegni APIs (used by Commercialista carnet)"""
    
    def test_assegni_list(self):
        """Test assegni list endpoint"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Assegni: {len(data)} assegni trovati")


class TestBilancioAPI:
    """Tests for Bilancio APIs"""
    
    def test_bilancio_stato_patrimoniale(self):
        """Test bilancio stato patrimoniale endpoint"""
        response = requests.get(f"{BASE_URL}/api/bilancio/stato-patrimoniale?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "attivo" in data
        assert "passivo" in data
        print(f"✅ Stato Patrimoniale: Attivo={data['attivo']['totale_attivo']}, Passivo={data['passivo']['totale_passivo']}")
    
    def test_bilancio_conto_economico(self):
        """Test bilancio conto economico endpoint"""
        response = requests.get(f"{BASE_URL}/api/bilancio/conto-economico?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "ricavi" in data or "anno" in data  # API may return different structure
        print(f"✅ Conto Economico endpoint working: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
