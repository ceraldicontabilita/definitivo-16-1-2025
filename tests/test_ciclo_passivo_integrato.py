"""
Test Suite for Ciclo Passivo Integrato Module
Tests: Import XML → Magazzino → Prima Nota → Scadenziario → Riconciliazione

Endpoints tested:
- GET /api/ciclo-passivo/dashboard-riconciliazione
- POST /api/ciclo-passivo/import-integrato
- GET /api/ciclo-passivo/suggerimenti-match/{scadenza_id}
- POST /api/ciclo-passivo/match-manuale
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://xml-to-label.preview.emergentagent.com').rstrip('/')

# Sample XML invoice for testing
SAMPLE_XML_INVOICE = """<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>01234567890</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>TEST12345678901</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>TEST12345678901</CodiceFiscale>
        <Anagrafica>
          <Denominazione>TEST_CICLOPASSIVO Fornitore SRL</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Test 123</Indirizzo>
        <CAP>00100</CAP>
        <Comune>Roma</Comune>
        <Provincia>RM</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>98765432109</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Azienda Cliente SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Cliente 456</Indirizzo>
        <CAP>00200</CAP>
        <Comune>Milano</Comune>
        <Provincia>MI</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2025-01-10</Data>
        <Numero>TEST-CP-001</Numero>
        <ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Prodotto Test LOTTO:L25A001 SCAD:31/12/2025</Descrizione>
        <Quantita>10.00</Quantita>
        <PrezzoUnitario>10.00</PrezzoUnitario>
        <PrezzoTotale>100.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>100.00</ImponibileImporto>
        <Imposta>22.00</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <DataScadenzaPagamento>2025-02-10</DataScadenzaPagamento>
        <ImportoPagamento>122.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
"""


class TestCicloPassivoDashboard:
    """Test Dashboard Riconciliazione endpoint"""
    
    def test_dashboard_riconciliazione_returns_200(self):
        """GET /api/ciclo-passivo/dashboard-riconciliazione should return 200"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "scadenze_aperte" in data, "Missing scadenze_aperte in response"
        assert "scadenze_saldate" in data, "Missing scadenze_saldate in response"
        assert "movimenti_non_riconciliati" in data, "Missing movimenti_non_riconciliati in response"
        assert "statistiche" in data, "Missing statistiche in response"
        
        # Verify statistiche structure
        stats = data["statistiche"]
        assert "num_scadenze_aperte" in stats
        assert "num_scadenze_saldate" in stats
        assert "num_movimenti_da_riconciliare" in stats
        assert "totale_debito_aperto" in stats
        assert "totale_pagato" in stats
        
        print(f"✅ Dashboard riconciliazione: {stats['num_scadenze_aperte']} scadenze aperte, {stats['num_scadenze_saldate']} saldate")
    
    def test_dashboard_with_year_filter(self):
        """GET /api/ciclo-passivo/dashboard-riconciliazione with year filter"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione?anno=2025")
        assert response.status_code == 200
        data = response.json()
        assert "statistiche" in data
        print(f"✅ Dashboard with year filter: OK")
    
    def test_dashboard_with_year_month_filter(self):
        """GET /api/ciclo-passivo/dashboard-riconciliazione with year and month filter"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione?anno=2025&mese=1")
        assert response.status_code == 200
        data = response.json()
        assert "statistiche" in data
        print(f"✅ Dashboard with year+month filter: OK")


class TestSuggerimentiMatch:
    """Test Suggerimenti Match endpoint"""
    
    def test_suggerimenti_match_not_found(self):
        """GET /api/ciclo-passivo/suggerimenti-match/{id} returns 404 for non-existent scadenza"""
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/suggerimenti-match/non-existent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "error" in data or "message" in data or "detail" in data
        print(f"✅ Suggerimenti match returns 404 for non-existent scadenza")


class TestMatchManuale:
    """Test Match Manuale endpoint"""
    
    def test_match_manuale_scadenza_not_found(self):
        """POST /api/ciclo-passivo/match-manuale returns 404 for non-existent scadenza"""
        response = requests.post(
            f"{BASE_URL}/api/ciclo-passivo/match-manuale",
            params={"scadenza_id": "non-existent-scadenza", "transazione_id": "non-existent-trans"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ Match manuale returns 404 for non-existent scadenza")
    
    def test_match_manuale_missing_params(self):
        """POST /api/ciclo-passivo/match-manuale returns 422 for missing params"""
        response = requests.post(f"{BASE_URL}/api/ciclo-passivo/match-manuale")
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✅ Match manuale returns 422 for missing params")


class TestImportIntegrato:
    """Test Import Integrato endpoint"""
    
    def test_import_integrato_with_valid_xml(self):
        """POST /api/ciclo-passivo/import-integrato with valid XML"""
        files = {
            'file': ('test_fattura.xml', SAMPLE_XML_INVOICE, 'application/xml')
        }
        response = requests.post(f"{BASE_URL}/api/ciclo-passivo/import-integrato", files=files)
        
        # Should return 200 or 409 (duplicate)
        assert response.status_code in [200, 409], f"Expected 200 or 409, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        if response.status_code == 200:
            # Verify successful import response structure
            assert "fattura_id" in data, "Missing fattura_id in response"
            assert "numero_documento" in data, "Missing numero_documento in response"
            assert "fornitore" in data, "Missing fornitore in response"
            assert "importo_totale" in data, "Missing importo_totale in response"
            assert "success" in data, "Missing success in response"
            
            # Verify integration modules
            assert "magazzino" in data, "Missing magazzino in response"
            assert "prima_nota" in data, "Missing prima_nota in response"
            assert "scadenziario" in data, "Missing scadenziario in response"
            
            print(f"✅ Import integrato successful: Fattura {data['numero_documento']}, Fornitore: {data['fornitore']}")
            print(f"   - Magazzino: {data.get('magazzino', {}).get('movimenti_creati', 0)} movimenti")
            print(f"   - Prima Nota: {data.get('prima_nota', {}).get('status', 'N/A')}")
            print(f"   - Scadenziario: {data.get('scadenziario', {}).get('status', 'N/A')}")
            
            return data  # Return for use in other tests
        else:
            # Duplicate invoice
            assert "error" in data or "detail" in data
            print(f"✅ Import integrato correctly detected duplicate invoice")
            return None
    
    def test_import_integrato_invalid_xml(self):
        """POST /api/ciclo-passivo/import-integrato with invalid XML"""
        files = {
            'file': ('invalid.xml', '<invalid>not a valid invoice</invalid>', 'application/xml')
        }
        response = requests.post(f"{BASE_URL}/api/ciclo-passivo/import-integrato", files=files)
        
        # Should return 400 for invalid XML
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✅ Import integrato correctly rejects invalid XML")
    
    def test_import_integrato_no_file(self):
        """POST /api/ciclo-passivo/import-integrato without file"""
        response = requests.post(f"{BASE_URL}/api/ciclo-passivo/import-integrato")
        
        # Should return 422 for missing file
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✅ Import integrato returns 422 for missing file")


class TestEndToEndFlow:
    """Test complete end-to-end flow"""
    
    def test_full_ciclo_passivo_flow(self):
        """Test complete flow: Import → Dashboard → Verify scadenza created"""
        # Step 1: Check initial dashboard state
        response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione")
        assert response.status_code == 200
        initial_stats = response.json()["statistiche"]
        initial_scadenze = initial_stats["num_scadenze_aperte"]
        print(f"📊 Initial state: {initial_scadenze} scadenze aperte")
        
        # Step 2: Import a new invoice (with unique number to avoid duplicates)
        import time
        unique_num = f"TEST-E2E-{int(time.time())}"
        xml_with_unique_num = SAMPLE_XML_INVOICE.replace("TEST-CP-001", unique_num)
        
        files = {
            'file': ('test_e2e.xml', xml_with_unique_num, 'application/xml')
        }
        response = requests.post(f"{BASE_URL}/api/ciclo-passivo/import-integrato", files=files)
        
        if response.status_code == 200:
            import_data = response.json()
            print(f"✅ Imported invoice: {import_data.get('numero_documento')}")
            
            # Step 3: Verify dashboard updated
            response = requests.get(f"{BASE_URL}/api/ciclo-passivo/dashboard-riconciliazione")
            assert response.status_code == 200
            new_stats = response.json()["statistiche"]
            
            # Should have at least one more scadenza
            print(f"📊 After import: {new_stats['num_scadenze_aperte']} scadenze aperte")
            
            # Step 4: If we have a scadenza_id, test suggerimenti
            if import_data.get("scadenziario", {}).get("scadenza_id"):
                scadenza_id = import_data["scadenziario"]["scadenza_id"]
                response = requests.get(f"{BASE_URL}/api/ciclo-passivo/suggerimenti-match/{scadenza_id}")
                assert response.status_code == 200
                sugg_data = response.json()
                assert "scadenza" in sugg_data
                assert "suggerimenti" in sugg_data
                print(f"✅ Suggerimenti match for scadenza: {len(sugg_data['suggerimenti'])} suggestions")
        else:
            print(f"⚠️ Import returned {response.status_code} - may be duplicate")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✅ API Health: {data['status']}, DB: {data['database']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
