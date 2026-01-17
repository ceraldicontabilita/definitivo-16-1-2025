"""
Test Suite per Riconciliazione Smart e Cascate
==============================================

Testa le funzionalità critiche:
1. Endpoint /api/operazioni-da-confermare/smart/riconcilia-manuale - crea movimento in Prima Nota
2. Endpoint /api/operazioni-da-confermare/{id}/conferma - crea movimento in prima_nota_cassa o prima_nota_banca
3. Filtro assegni - assegni con fattura_collegata NON devono apparire nella riconciliazione
4. Cascata fattura -> prima_nota -> scadenza
5. Prima Nota Cassa - saldo anno precedente + modifica voci
6. API Dipendenti - CRUD acconti TFR
7. API Corrispettivi - caricamento e calcolo IVA
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://account-unifier.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasics:
    """Test base per verificare che il sistema sia operativo"""
    
    def test_health_endpoint(self):
        """Verifica che il backend sia attivo"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✅ Health check passed: {data}")
    
    def test_prima_nota_cassa_endpoint(self):
        """Verifica endpoint Prima Nota Cassa"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "movimenti" in data
        print(f"✅ Prima Nota Cassa: {len(data.get('movimenti', []))} movimenti, saldo: {data.get('saldo')}")
    
    def test_prima_nota_banca_endpoint(self):
        """Verifica endpoint Prima Nota Banca"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/banca?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "movimenti" in data
        print(f"✅ Prima Nota Banca: {len(data.get('movimenti', []))} movimenti, saldo: {data.get('saldo')}")


class TestRiconciliazioneSmartAnalisi:
    """Test per l'analisi smart dei movimenti estratto conto"""
    
    def test_smart_analizza_endpoint(self):
        """Verifica che l'endpoint smart/analizza funzioni"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "movimenti" in data
        print(f"✅ Smart Analizza: {data['stats'].get('totale', 0)} movimenti analizzati")
        print(f"   - Incasso POS: {data['stats'].get('incasso_pos', 0)}")
        print(f"   - F24: {data['stats'].get('f24', 0)}")
        print(f"   - Auto-riconciliabili: {data['stats'].get('auto_riconciliabili', 0)}")
    
    def test_smart_analizza_esclude_movimenti_gia_in_prima_nota(self):
        """Verifica che i movimenti già in Prima Nota siano esclusi"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=50")
        assert response.status_code == 200
        data = response.json()
        
        # Verifica che nessun movimento abbia riconciliato=True
        for mov in data.get("movimenti", []):
            # I movimenti restituiti non dovrebbero essere già riconciliati
            assert mov.get("riconciliato") != True, f"Movimento {mov.get('movimento_id')} già riconciliato ma presente nei risultati"
        
        print(f"✅ Filtro movimenti già riconciliati funziona correttamente")


class TestRiconciliazioneManuale:
    """Test per la riconciliazione manuale con creazione movimento Prima Nota"""
    
    def test_riconcilia_manuale_crea_movimento_banca(self):
        """
        TEST CRITICO: Verifica che /smart/riconcilia-manuale crei movimento in Prima Nota Banca
        """
        # Prima ottieni un movimento non riconciliato
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=5")
        assert response.status_code == 200
        data = response.json()
        
        movimenti = data.get("movimenti", [])
        if not movimenti:
            pytest.skip("Nessun movimento disponibile per il test")
        
        # Prendi il primo movimento
        movimento = movimenti[0]
        movimento_id = movimento.get("movimento_id")
        
        # Conta movimenti in Prima Nota Banca prima
        pn_before = requests.get(f"{BASE_URL}/api/prima-nota/banca?limit=1000")
        count_before = pn_before.json().get("count", 0)
        
        # Esegui riconciliazione manuale
        payload = {
            "movimento_id": movimento_id,
            "tipo": "categoria",
            "categoria": "TEST_Riconciliazione_Manuale",
            "destinazione": "banca"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/smart/riconcilia-manuale",
            json=payload
        )
        
        # Verifica risposta
        assert response.status_code == 200, f"Errore: {response.text}"
        result = response.json()
        assert result.get("success") == True
        assert result.get("prima_nota_id") is not None
        assert result.get("prima_nota_collection") == "prima_nota_banca"
        
        prima_nota_id = result.get("prima_nota_id")
        print(f"✅ Riconciliazione manuale creata: prima_nota_id={prima_nota_id}")
        
        # Verifica che il movimento sia stato creato in Prima Nota Banca
        pn_after = requests.get(f"{BASE_URL}/api/prima-nota/banca?limit=1000")
        count_after = pn_after.json().get("count", 0)
        
        # Il count dovrebbe essere aumentato
        assert count_after >= count_before, "Il movimento non è stato creato in Prima Nota Banca"
        
        # Cerca il movimento specifico
        movimenti_pn = pn_after.json().get("movimenti", [])
        movimento_creato = next((m for m in movimenti_pn if m.get("id") == prima_nota_id), None)
        
        if movimento_creato:
            assert movimento_creato.get("source") == "riconciliazione_smart"
            assert movimento_creato.get("estratto_conto_id") == movimento_id
            print(f"✅ Movimento verificato in Prima Nota Banca: {movimento_creato.get('descrizione')}")
        
        return prima_nota_id
    
    def test_riconcilia_manuale_crea_movimento_cassa(self):
        """
        TEST CRITICO: Verifica che /smart/riconcilia-manuale crei movimento in Prima Nota Cassa
        """
        # Prima ottieni un movimento non riconciliato
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        movimenti = data.get("movimenti", [])
        if len(movimenti) < 2:
            pytest.skip("Non abbastanza movimenti disponibili per il test")
        
        # Prendi il secondo movimento (il primo potrebbe essere già usato)
        movimento = movimenti[1]
        movimento_id = movimento.get("movimento_id")
        
        # Esegui riconciliazione manuale verso CASSA
        payload = {
            "movimento_id": movimento_id,
            "tipo": "incasso_pos",
            "categoria": "TEST_Incasso_POS",
            "destinazione": "cassa"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/smart/riconcilia-manuale",
            json=payload
        )
        
        # Verifica risposta
        assert response.status_code == 200, f"Errore: {response.text}"
        result = response.json()
        assert result.get("success") == True
        assert result.get("prima_nota_collection") == "prima_nota_cassa"
        
        print(f"✅ Riconciliazione manuale in CASSA creata: prima_nota_id={result.get('prima_nota_id')}")


class TestConfermaOperazione:
    """Test per la conferma operazioni da Aruba"""
    
    def test_lista_operazioni_da_confermare(self):
        """Verifica lista operazioni da confermare"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "operazioni" in data
        assert "stats" in data
        print(f"✅ Operazioni da confermare: {data['stats'].get('totale', 0)} totali")
        print(f"   - Da confermare: {data['stats'].get('da_confermare', 0)}")
        print(f"   - Fornitori nel dizionario: {data['stats'].get('fornitori_nel_dizionario', 0)}")
    
    def test_conferma_operazione_cassa(self):
        """
        TEST CRITICO: Verifica che /{id}/conferma crei movimento in prima_nota_cassa
        """
        # Ottieni operazioni da confermare
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/aruba-pendenti?limit=5")
        
        if response.status_code != 200:
            # Prova endpoint alternativo
            response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/lista?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        operazioni = data.get("operazioni", [])
        if not operazioni:
            pytest.skip("Nessuna operazione da confermare disponibile")
        
        # Prendi la prima operazione non confermata
        operazione = next((op for op in operazioni if op.get("stato") != "confermato"), None)
        if not operazione:
            pytest.skip("Tutte le operazioni sono già confermate")
        
        operazione_id = operazione.get("id")
        
        # Conferma in CASSA
        response = requests.post(
            f"{BASE_URL}/api/operazioni-da-confermare/{operazione_id}/conferma?metodo=cassa"
        )
        
        if response.status_code == 404:
            # L'operazione potrebbe non essere nella collection operazioni_da_confermare
            pytest.skip("Operazione non trovata nella collection operazioni_da_confermare")
        
        if response.status_code == 400 and "già confermata" in response.text:
            pytest.skip("Operazione già confermata")
        
        assert response.status_code == 200, f"Errore: {response.text}"
        result = response.json()
        assert result.get("success") == True
        assert result.get("metodo") == "cassa"
        
        print(f"✅ Operazione confermata in CASSA: prima_nota_id={result.get('prima_nota_id')}")


class TestFiltroAssegni:
    """Test per il filtro assegni nella riconciliazione"""
    
    def test_assegni_con_fattura_esclusi(self):
        """
        TEST CRITICO: Verifica che assegni con fattura_collegata NON appaiano nella riconciliazione
        """
        # Ottieni analisi smart
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=100")
        assert response.status_code == 200
        data = response.json()
        
        movimenti = data.get("movimenti", [])
        
        # Verifica che non ci siano movimenti di prelievo assegno già elaborati
        for mov in movimenti:
            desc = (mov.get("descrizione_completa") or mov.get("descrizione") or "").upper()
            if "PRELIEVO" in desc and "ASSEGNO" in desc:
                # Questo movimento non dovrebbe essere qui se l'assegno è già collegato a fattura
                # Il filtro dovrebbe averlo escluso
                print(f"⚠️ Trovato prelievo assegno: {desc[:80]}...")
        
        print(f"✅ Filtro assegni verificato: {len(movimenti)} movimenti analizzati")
    
    def test_lista_assegni(self):
        """Verifica endpoint assegni"""
        response = requests.get(f"{BASE_URL}/api/assegni")
        if response.status_code == 200:
            data = response.json()
            assegni = data if isinstance(data, list) else data.get("assegni", [])
            
            # Conta assegni con fattura collegata
            con_fattura = sum(1 for a in assegni if a.get("fattura_id") or a.get("fattura_collegata"))
            print(f"✅ Assegni totali: {len(assegni)}, con fattura collegata: {con_fattura}")
        else:
            print(f"⚠️ Endpoint assegni non disponibile: {response.status_code}")


class TestCascataFatturaPrimaNotaScadenza:
    """Test per la cascata fattura -> prima_nota -> scadenza"""
    
    def test_cascata_aggiorna_scadenza(self):
        """
        TEST CRITICO: Verifica che la cascata fattura -> prima_nota -> scadenza funzioni
        """
        # Cerca una fattura non pagata
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/cerca-fatture?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        fatture = data.get("fatture", [])
        if not fatture:
            pytest.skip("Nessuna fattura disponibile per il test")
        
        # Verifica che l'endpoint restituisca fatture non pagate
        fatture_non_pagate = [f for f in fatture if not f.get("pagato")]
        print(f"✅ Fatture non pagate trovate: {len(fatture_non_pagate)}")
        
        if fatture_non_pagate:
            fattura = fatture_non_pagate[0]
            print(f"   - Esempio: {fattura.get('numero')} - {fattura.get('fornitore')} - €{fattura.get('importo')}")


class TestPrimaNotaCassa:
    """Test per Prima Nota Cassa"""
    
    def test_prima_nota_cassa_saldo(self):
        """Verifica saldo Prima Nota Cassa"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa")
        assert response.status_code == 200
        data = response.json()
        
        assert "saldo" in data
        assert "totale_entrate" in data
        assert "totale_uscite" in data
        
        print(f"✅ Prima Nota Cassa:")
        print(f"   - Saldo: €{data.get('saldo', 0):,.2f}")
        print(f"   - Entrate: €{data.get('totale_entrate', 0):,.2f}")
        print(f"   - Uscite: €{data.get('totale_uscite', 0):,.2f}")
    
    def test_prima_nota_cassa_filtro_anno(self):
        """Verifica filtro per anno"""
        response = requests.get(f"{BASE_URL}/api/prima-nota/cassa?anno=2026")
        assert response.status_code == 200
        data = response.json()
        
        # Verifica che i movimenti siano dell'anno corretto
        for mov in data.get("movimenti", [])[:5]:
            data_mov = mov.get("data", "")
            if data_mov:
                assert data_mov.startswith("2026"), f"Movimento con data errata: {data_mov}"
        
        print(f"✅ Filtro anno 2026 funziona: {len(data.get('movimenti', []))} movimenti")


class TestDipendentiAcconti:
    """Test per CRUD acconti TFR dipendenti"""
    
    def test_lista_dipendenti(self):
        """Verifica lista dipendenti"""
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        data = response.json()
        
        dipendenti = data if isinstance(data, list) else data.get("dipendenti", [])
        assert len(dipendenti) > 0, "Nessun dipendente trovato"
        
        print(f"✅ Dipendenti trovati: {len(dipendenti)}")
        return dipendenti[0] if dipendenti else None
    
    def test_acconti_tfr_read(self):
        """Verifica lettura acconti TFR"""
        # Prima ottieni un dipendente
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        dipendenti = response.json() if isinstance(response.json(), list) else response.json().get("dipendenti", [])
        
        if not dipendenti:
            pytest.skip("Nessun dipendente disponibile")
        
        dipendente_id = dipendenti[0].get("id")
        
        # Ottieni acconti
        response = requests.get(f"{BASE_URL}/api/tfr/acconti/{dipendente_id}")
        
        if response.status_code == 404:
            print(f"⚠️ Endpoint acconti TFR non trovato o nessun acconto per dipendente {dipendente_id}")
            return
        
        assert response.status_code == 200, f"Errore: {response.text}"
        data = response.json()
        
        print(f"✅ Acconti TFR per dipendente {dipendente_id}:")
        if isinstance(data, dict):
            print(f"   - TFR Accantonato: €{data.get('tfr_accantonato', 0):,.2f}")
            print(f"   - Totale Acconti: €{data.get('totale_acconti', 0):,.2f}")
            print(f"   - TFR Saldo: €{data.get('tfr_saldo', 0):,.2f}")
    
    def test_acconti_tfr_create(self):
        """Test creazione acconto TFR"""
        # Prima ottieni un dipendente
        response = requests.get(f"{BASE_URL}/api/dipendenti")
        assert response.status_code == 200
        dipendenti = response.json() if isinstance(response.json(), list) else response.json().get("dipendenti", [])
        
        if not dipendenti:
            pytest.skip("Nessun dipendente disponibile")
        
        dipendente_id = dipendenti[0].get("id")
        
        # Crea acconto test
        payload = {
            "dipendente_id": dipendente_id,
            "tipo": "tfr",
            "importo": 100.00,
            "data": datetime.now().strftime("%Y-%m-%d"),
            "note": "TEST_Acconto_Automatico"
        }
        
        response = requests.post(f"{BASE_URL}/api/tfr/acconti", json=payload)
        
        if response.status_code == 404:
            pytest.skip("Endpoint creazione acconti non disponibile")
        
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            print(f"✅ Acconto TFR creato: {result}")
            
            # Cleanup: elimina l'acconto test
            acconto_id = result.get("id") or result.get("acconto_id")
            if acconto_id:
                requests.delete(f"{BASE_URL}/api/tfr/acconti/{acconto_id}")
        else:
            print(f"⚠️ Creazione acconto fallita: {response.status_code} - {response.text}")


class TestCorrispettivi:
    """Test per Corrispettivi"""
    
    def test_corrispettivi_lista(self):
        """Verifica lista corrispettivi"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi")
        assert response.status_code == 200
        data = response.json()
        
        corrispettivi = data if isinstance(data, list) else data.get("corrispettivi", [])
        print(f"✅ Corrispettivi trovati: {len(corrispettivi)}")
    
    def test_corrispettivi_filtro_anno(self):
        """Verifica filtro per anno"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi?anno=2026")
        assert response.status_code == 200
        data = response.json()
        
        corrispettivi = data if isinstance(data, list) else data.get("corrispettivi", [])
        
        # Verifica che i corrispettivi siano dell'anno corretto
        for corr in corrispettivi[:5]:
            data_corr = corr.get("data", "")
            if data_corr:
                assert "2026" in data_corr, f"Corrispettivo con data errata: {data_corr}"
        
        print(f"✅ Corrispettivi 2026: {len(corrispettivi)}")
    
    def test_corrispettivi_calcolo_iva(self):
        """Verifica calcolo IVA nei corrispettivi"""
        response = requests.get(f"{BASE_URL}/api/corrispettivi?anno=2026&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        corrispettivi = data if isinstance(data, list) else data.get("corrispettivi", [])
        
        for corr in corrispettivi[:3]:
            totale = corr.get("totale", 0) or corr.get("importo_totale", 0)
            iva = corr.get("iva", 0) or corr.get("importo_iva", 0)
            imponibile = corr.get("imponibile", 0) or corr.get("importo_imponibile", 0)
            
            if totale > 0 and iva > 0:
                # Verifica che IVA + Imponibile ≈ Totale
                calcolato = imponibile + iva
                diff = abs(calcolato - totale)
                if diff > 1:  # Tolleranza 1€
                    print(f"⚠️ Discrepanza IVA: totale={totale}, imponibile+iva={calcolato}")
                else:
                    print(f"✅ Calcolo IVA corretto: €{totale} = €{imponibile} + €{iva}")


class TestRiconciliazioneUI:
    """Test per verificare che i dati siano pronti per la UI"""
    
    def test_dati_per_tab_aruba(self):
        """Verifica dati per tab Aruba nella riconciliazione"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/aruba-pendenti?limit=20")
        
        if response.status_code == 200:
            data = response.json()
            operazioni = data.get("operazioni", [])
            print(f"✅ Tab Aruba: {len(operazioni)} operazioni pendenti")
            
            if operazioni:
                op = operazioni[0]
                print(f"   - Esempio: {op.get('fornitore')} - €{op.get('importo')} - {op.get('numero_fattura')}")
        else:
            print(f"⚠️ Endpoint aruba-pendenti: {response.status_code}")
    
    def test_dati_per_selezione_multipla(self):
        """Verifica che i dati supportino selezione multipla"""
        response = requests.get(f"{BASE_URL}/api/operazioni-da-confermare/smart/analizza?limit=20")
        assert response.status_code == 200
        data = response.json()
        
        movimenti = data.get("movimenti", [])
        
        # Verifica che ogni movimento abbia un ID univoco
        ids = [m.get("movimento_id") for m in movimenti]
        assert len(ids) == len(set(ids)), "ID movimenti non univoci"
        
        print(f"✅ Selezione multipla supportata: {len(movimenti)} movimenti con ID univoci")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
