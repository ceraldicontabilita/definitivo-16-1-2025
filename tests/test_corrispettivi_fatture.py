"""
Backend API Tests for Corrispettivi and Fatture XML Upload
Tests: GET endpoints, single XML upload, bulk XML upload, duplicate detection
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://autopay-2.preview.emergentagent.com').rstrip('/')

# Sample valid FatturaPA XML (Italian electronic invoice format)
SAMPLE_FATTURA_XML = '''<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>01234567890</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>TEST_SUPPLIER_VAT</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>TEST Fornitore SRL</Denominazione>
        </Anagrafica>
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
          <IdCodice>09876543210</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Cliente Test SPA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via Cliente 456</Indirizzo>
        <CAP>20100</CAP>
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
        <Data>2025-01-04</Data>
        <Numero>TEST_INVOICE_NUM</Numero>
        <ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Servizio di consulenza</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>100.00</PrezzoUnitario>
        <PrezzoTotale>100.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>100.00</ImponibileImporto>
        <Imposta>22.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <DataScadenzaPagamento>2025-02-04</DataScadenzaPagamento>
        <ImportoPagamento>122.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</FatturaElettronica>'''

# Sample valid Corrispettivo XML (Italian daily receipts format)
SAMPLE_CORRISPETTIVO_XML = '''<?xml version="1.0" encoding="UTF-8"?>
<Corrispettivi>
  <Trasmittente>
    <IdPaese>IT</IdPaese>
    <IdCodice>TEST_CORR_VAT</IdCodice>
    <ProgressivoInvio>00001</ProgressivoInvio>
  </Trasmittente>
  <Cedente>
    <PartitaIVA>TEST_CORR_VAT</PartitaIVA>
    <CodiceFiscale>TESTCF12345678901</CodiceFiscale>
    <Denominazione>TEST Esercizio SRL</Denominazione>
    <Indirizzo>Via Negozio 1</Indirizzo>
    <CAP>00100</CAP>
    <Comune>Roma</Comune>
    <Provincia>RM</Provincia>
  </Cedente>
  <DatiCorrispettivi>
    <DataOraRilevazione>TEST_DATE</DataOraRilevazione>
    <MatricolaRT>TEST_MATRICOLA</MatricolaRT>
    <NumeroDocumento>TEST_DOC_NUM</NumeroDocumento>
    <Ammontare>150.00</Ammontare>
    <Imposta>27.05</Imposta>
    <Riepilogo>
      <AliquotaIVA>22.00</AliquotaIVA>
      <Ammontare>122.95</Ammontare>
      <Imposta>27.05</Imposta>
    </Riepilogo>
  </DatiCorrispettivi>
</Corrispettivi>'''


class TestCorrispettiviAPI:
    """Tests for Corrispettivi endpoints"""
    
    def test_get_corrispettivi_returns_list(self):
        """GET /api/corrispettivi should return a list"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/corrispettivi returns list with {len(data)} items")
    
    def test_upload_single_corrispettivo_xml(self):
        """POST /api/corrispettivi/upload-xml should upload and parse XML"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        xml_content = SAMPLE_CORRISPETTIVO_XML.replace('TEST_CORR_VAT', f'VAT{unique_id}')
        xml_content = xml_content.replace('TEST_DATE', '2025-01-04')
        xml_content = xml_content.replace('TEST_MATRICOLA', f'RT{unique_id}')
        xml_content = xml_content.replace('TEST_DOC_NUM', f'DOC{unique_id}')
        
        files = {'file': (f'test_corrispettivo_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        response = requests.post(f"{BASE_URL}/api/corrispettivi/upload-xml", files=files)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True, f"Expected success=True, got {data}"
        assert 'corrispettivo' in data, f"Expected 'corrispettivo' in response, got {data.keys()}"
        print(f"✓ Single corrispettivo upload successful: {data.get('message')}")
        return data.get('corrispettivo', {}).get('id')
    
    def test_upload_corrispettivo_duplicate_detection(self):
        """Uploading same corrispettivo twice should return 409 conflict"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        xml_content = SAMPLE_CORRISPETTIVO_XML.replace('TEST_CORR_VAT', f'DUP{unique_id}')
        xml_content = xml_content.replace('TEST_DATE', '2025-01-04')
        xml_content = xml_content.replace('TEST_MATRICOLA', f'RTDUP{unique_id}')
        xml_content = xml_content.replace('TEST_DOC_NUM', f'DOCDUP{unique_id}')
        
        files = {'file': (f'test_dup_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        
        # First upload should succeed
        response1 = requests.post(f"{BASE_URL}/api/corrispettivi/upload-xml", files=files)
        assert response1.status_code in [200, 201], f"First upload failed: {response1.status_code}: {response1.text}"
        
        # Second upload with same data should fail with 409
        files2 = {'file': (f'test_dup_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        response2 = requests.post(f"{BASE_URL}/api/corrispettivi/upload-xml", files=files2)
        assert response2.status_code == 409, f"Expected 409 for duplicate, got {response2.status_code}: {response2.text}"
        print(f"✓ Duplicate corrispettivo correctly rejected with 409")
    
    def test_bulk_upload_corrispettivi_xml(self):
        """POST /api/corrispettivi/upload-xml-bulk should handle multiple files"""
        import uuid
        
        files = []
        for i in range(3):
            unique_id = str(uuid.uuid4())[:8]
            xml_content = SAMPLE_CORRISPETTIVO_XML.replace('TEST_CORR_VAT', f'BULK{unique_id}')
            xml_content = xml_content.replace('TEST_DATE', f'2025-01-0{i+1}')
            xml_content = xml_content.replace('TEST_MATRICOLA', f'RTBULK{unique_id}')
            xml_content = xml_content.replace('TEST_DOC_NUM', f'DOCBULK{unique_id}')
            files.append(('files', (f'bulk_{i}_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')))
        
        response = requests.post(f"{BASE_URL}/api/corrispettivi/upload-xml-bulk", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'imported' in data, f"Expected 'imported' in response, got {data.keys()}"
        assert 'total' in data, f"Expected 'total' in response, got {data.keys()}"
        assert data['total'] == 3, f"Expected total=3, got {data['total']}"
        print(f"✓ Bulk upload: {data['imported']} imported, {data.get('skipped_duplicates', 0)} duplicates, {data.get('failed', 0)} failed")
    
    def test_delete_corrispettivo(self):
        """DELETE /api/corrispettivi/{id} should delete a corrispettivo"""
        # First create one
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        xml_content = SAMPLE_CORRISPETTIVO_XML.replace('TEST_CORR_VAT', f'DEL{unique_id}')
        xml_content = xml_content.replace('TEST_DATE', '2025-01-04')
        xml_content = xml_content.replace('TEST_MATRICOLA', f'RTDEL{unique_id}')
        xml_content = xml_content.replace('TEST_DOC_NUM', f'DOCDEL{unique_id}')
        
        files = {'file': (f'test_del_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        create_response = requests.post(f"{BASE_URL}/api/corrispettivi/upload-xml", files=files)
        
        if create_response.status_code in [200, 201]:
            corr_id = create_response.json().get('corrispettivo', {}).get('id')
            if corr_id:
                delete_response = requests.delete(f"{BASE_URL}/api/corrispettivi/{corr_id}")
                assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}: {delete_response.text}"
                print(f"✓ Corrispettivo {corr_id} deleted successfully")
            else:
                print("⚠ Could not get corrispettivo ID for delete test")
        else:
            print(f"⚠ Could not create corrispettivo for delete test: {create_response.status_code}")


class TestFattureAPI:
    """Tests for Fatture (Invoices) endpoints"""
    
    def test_get_invoices_returns_list(self):
        """GET /api/invoices should return a list"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ GET /api/invoices returns list with {len(data)} items")
    
    def test_upload_single_fattura_xml(self):
        """POST /api/fatture/upload-xml should upload and parse XML"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        xml_content = SAMPLE_FATTURA_XML.replace('TEST_SUPPLIER_VAT', f'VAT{unique_id}')
        xml_content = xml_content.replace('TEST_INVOICE_NUM', f'FT-TEST-{unique_id}')
        
        files = {'file': (f'test_fattura_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        response = requests.post(f"{BASE_URL}/api/fatture/upload-xml", files=files)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True, f"Expected success=True, got {data}"
        assert 'invoice' in data, f"Expected 'invoice' in response, got {data.keys()}"
        
        # Verify invoice data
        invoice = data['invoice']
        assert invoice.get('supplier_name') == 'TEST Fornitore SRL', f"Wrong supplier name: {invoice.get('supplier_name')}"
        assert invoice.get('total_amount') == 122.0, f"Wrong total: {invoice.get('total_amount')}"
        print(f"✓ Single fattura upload successful: {data.get('message')}")
        return invoice.get('id')
    
    def test_upload_fattura_duplicate_detection(self):
        """Uploading same fattura twice should return 409 conflict"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        xml_content = SAMPLE_FATTURA_XML.replace('TEST_SUPPLIER_VAT', f'DUP{unique_id}')
        xml_content = xml_content.replace('TEST_INVOICE_NUM', f'FT-DUP-{unique_id}')
        
        files = {'file': (f'test_dup_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        
        # First upload should succeed
        response1 = requests.post(f"{BASE_URL}/api/fatture/upload-xml", files=files)
        assert response1.status_code in [200, 201], f"First upload failed: {response1.status_code}: {response1.text}"
        
        # Second upload with same data should fail with 409
        files2 = {'file': (f'test_dup_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        response2 = requests.post(f"{BASE_URL}/api/fatture/upload-xml", files=files2)
        assert response2.status_code == 409, f"Expected 409 for duplicate, got {response2.status_code}: {response2.text}"
        print(f"✓ Duplicate fattura correctly rejected with 409")
    
    def test_bulk_upload_fatture_xml(self):
        """POST /api/fatture/upload-xml-bulk should handle multiple files"""
        import uuid
        
        files = []
        for i in range(3):
            unique_id = str(uuid.uuid4())[:8]
            xml_content = SAMPLE_FATTURA_XML.replace('TEST_SUPPLIER_VAT', f'BULK{unique_id}')
            xml_content = xml_content.replace('TEST_INVOICE_NUM', f'FT-BULK-{unique_id}')
            files.append(('files', (f'bulk_{i}_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')))
        
        response = requests.post(f"{BASE_URL}/api/fatture/upload-xml-bulk", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'imported' in data, f"Expected 'imported' in response, got {data.keys()}"
        assert 'total' in data, f"Expected 'total' in response, got {data.keys()}"
        assert data['total'] == 3, f"Expected total=3, got {data['total']}"
        print(f"✓ Bulk upload: {data['imported']} imported, {data.get('skipped_duplicates', 0)} duplicates, {data.get('failed', 0)} failed")
    
    def test_delete_invoice(self):
        """DELETE /api/invoices/{id} should delete an invoice"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        xml_content = SAMPLE_FATTURA_XML.replace('TEST_SUPPLIER_VAT', f'DEL{unique_id}')
        xml_content = xml_content.replace('TEST_INVOICE_NUM', f'FT-DEL-{unique_id}')
        
        files = {'file': (f'test_del_{unique_id}.xml', xml_content.encode('utf-8'), 'application/xml')}
        create_response = requests.post(f"{BASE_URL}/api/fatture/upload-xml", files=files)
        
        if create_response.status_code in [200, 201]:
            inv_id = create_response.json().get('invoice', {}).get('id')
            if inv_id:
                delete_response = requests.delete(f"{BASE_URL}/api/invoices/{inv_id}")
                assert delete_response.status_code == 200, f"Delete failed: {delete_response.status_code}: {delete_response.text}"
                print(f"✓ Invoice {inv_id} deleted successfully")
            else:
                print("⚠ Could not get invoice ID for delete test")
        else:
            print(f"⚠ Could not create invoice for delete test: {create_response.status_code}")
    
    def test_upload_invalid_xml_returns_400(self):
        """Uploading invalid XML should return 400"""
        invalid_xml = "This is not valid XML content"
        files = {'file': ('invalid.xml', invalid_xml.encode('utf-8'), 'application/xml')}
        response = requests.post(f"{BASE_URL}/api/fatture/upload-xml", files=files)
        assert response.status_code == 400, f"Expected 400 for invalid XML, got {response.status_code}: {response.text}"
        print(f"✓ Invalid XML correctly rejected with 400")
    
    def test_upload_non_xml_file_returns_400(self):
        """Uploading non-XML file should return 400"""
        files = {'file': ('test.txt', b'Not an XML file', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/fatture/upload-xml", files=files)
        assert response.status_code == 400, f"Expected 400 for non-XML file, got {response.status_code}: {response.text}"
        print(f"✓ Non-XML file correctly rejected with 400")


class TestManualInvoiceCreation:
    """Tests for manual invoice creation"""
    
    def test_create_manual_invoice(self):
        """POST /api/invoices should create a manual invoice"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        invoice_data = {
            "invoice_number": f"MANUAL-{unique_id}",
            "supplier_name": "Test Manual Supplier",
            "total_amount": 500.00,
            "invoice_date": "2025-01-04",
            "description": "Test manual invoice",
            "status": "pending"
        }
        
        response = requests.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('invoice_number') == invoice_data['invoice_number'], f"Wrong invoice number: {data.get('invoice_number')}"
        assert data.get('total_amount') == invoice_data['total_amount'], f"Wrong total: {data.get('total_amount')}"
        print(f"✓ Manual invoice created: {data.get('invoice_number')}")
        
        # Cleanup
        if data.get('id'):
            requests.delete(f"{BASE_URL}/api/invoices/{data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
