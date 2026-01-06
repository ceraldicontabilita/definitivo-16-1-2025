"""
Test Contabilità Avanzata APIs
Tests for:
- /api/contabilita/categorizzazione-preview - categorize product descriptions
- /api/contabilita/calcolo-imposte - calculate IRES 24% and IRAP by region
- /api/contabilita/statistiche-categorizzazione - show category distribution
- /api/contabilita/bilancio-dettagliato - show Conto Economico and Stato Patrimoniale
- /api/contabilita/inizializza-piano-esteso - add new accounts to Piano dei Conti
- /api/contabilita/aliquote-irap - get IRAP rates by region
- /api/contabilita/piano-conti-esteso - get extended chart of accounts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCategorizzazionePreview:
    """Test categorization preview endpoint"""
    
    def test_categorizza_bevande_alcoliche_limoncello(self):
        """Test: LIMONCELLO should be categorized as bevande_alcoliche → conto 05.01.03"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/categorizzazione-preview",
            params={"descrizione": "LIMONCELLO 30% vol", "fornitore": ""}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify categorization
        assert data["categorizzazione"]["categoria_merceologica"] == "bevande_alcoliche"
        assert data["categorizzazione"]["conto_codice"] == "05.01.03"
        assert data["categorizzazione"]["conto_nome"] == "Acquisto bevande alcoliche"
        assert data["categorizzazione"]["deducibilita_ires"] == 100
        assert data["categorizzazione"]["deducibilita_irap"] == 100
        assert data["categorizzazione"]["confidenza"] >= 0.7
        print(f"✓ LIMONCELLO correctly categorized: {data['categorizzazione']['conto_codice']} - {data['categorizzazione']['conto_nome']}")
    
    def test_categorizza_telefonia_tim_wifi(self):
        """Test: TIM Wi-Fi should be categorized as telefonia → conto 05.02.07 (80% deducible)"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/categorizzazione-preview",
            params={"descrizione": "TIM Wi-Fi Business", "fornitore": "TIM S.p.A."}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify categorization
        assert data["categorizzazione"]["categoria_merceologica"] == "telefonia"
        assert data["categorizzazione"]["conto_codice"] == "05.02.07"
        assert data["categorizzazione"]["conto_nome"] == "Telefonia e comunicazioni"
        assert data["categorizzazione"]["deducibilita_ires"] == 80
        assert data["categorizzazione"]["deducibilita_irap"] == 80
        print(f"✓ TIM Wi-Fi correctly categorized: {data['categorizzazione']['conto_codice']} - {data['categorizzazione']['deducibilita_ires']}% deducible")
    
    def test_categorizza_google_workspace(self):
        """Test: Google Workspace should be categorized as software_cloud → conto 05.02.08"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/categorizzazione-preview",
            params={"descrizione": "Google Workspace Business", "fornitore": "Google"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify categorization
        assert data["categorizzazione"]["categoria_merceologica"] == "software_cloud"
        assert data["categorizzazione"]["conto_codice"] == "05.02.08"
        assert data["categorizzazione"]["conto_nome"] == "Software e servizi cloud"
        assert data["categorizzazione"]["deducibilita_ires"] == 100
        print(f"✓ Google Workspace correctly categorized: {data['categorizzazione']['conto_codice']} - {data['categorizzazione']['conto_nome']}")
    
    def test_categorizza_carburante(self):
        """Test: Carburante (Benzina) should be categorized → conto 05.02.11"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/categorizzazione-preview",
            params={"descrizione": "Benzina super", "fornitore": "ENI Station"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify categorization
        assert data["categorizzazione"]["categoria_merceologica"] == "carburante"
        assert data["categorizzazione"]["conto_codice"] == "05.02.11"
        assert data["categorizzazione"]["conto_nome"] == "Carburanti e lubrificanti"
        # Note: 100% if strumentale, 20% if uso promiscuo - default is 100%
        assert data["categorizzazione"]["deducibilita_ires"] == 100
        print(f"✓ Carburante correctly categorized: {data['categorizzazione']['conto_codice']} - {data['categorizzazione']['note_fiscali']}")
    
    def test_categorizza_vino(self):
        """Test: Vino should be categorized as bevande_alcoliche"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/categorizzazione-preview",
            params={"descrizione": "Vino Rosso DOC", "fornitore": ""}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["categorizzazione"]["categoria_merceologica"] == "bevande_alcoliche"
        assert data["categorizzazione"]["conto_codice"] == "05.01.03"
        print(f"✓ Vino correctly categorized: {data['categorizzazione']['conto_codice']}")
    
    def test_categorizza_prodotti_alimentari(self):
        """Test: Food products should be categorized as alimentari"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/categorizzazione-preview",
            params={"descrizione": "Pasta Barilla 500g", "fornitore": ""}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["categorizzazione"]["categoria_merceologica"] == "alimentari"
        assert data["categorizzazione"]["conto_codice"] == "05.01.05"
        assert data["categorizzazione"]["conto_nome"] == "Acquisto prodotti alimentari"
        print(f"✓ Alimentari correctly categorized: {data['categorizzazione']['conto_codice']}")


class TestCalcoloImposte:
    """Test tax calculation endpoint"""
    
    def test_calcolo_imposte_default_region(self):
        """Test: Calculate taxes with default region"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "utile_civilistico" in data
        assert "ires" in data
        assert "irap" in data
        assert "totale_imposte" in data
        assert "aliquota_effettiva" in data
        
        # Verify IRES structure
        assert data["ires"]["aliquota"] == 24.0
        assert "reddito_imponibile" in data["ires"]
        assert "imposta_dovuta" in data["ires"]
        assert "variazioni_aumento" in data["ires"]
        assert "variazioni_diminuzione" in data["ires"]
        
        # Verify IRAP structure
        assert "aliquota" in data["irap"]
        assert "valore_produzione" in data["irap"]
        assert "base_imponibile" in data["irap"]
        assert "imposta_dovuta" in data["irap"]
        
        print(f"✓ Calcolo imposte OK - Utile: €{data['utile_civilistico']}, IRES: €{data['ires']['imposta_dovuta']}, IRAP: €{data['irap']['imposta_dovuta']}")
    
    def test_calcolo_imposte_calabria(self):
        """Test: Calculate taxes for Calabria region (IRAP 3.9%)"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/calcolo-imposte",
            params={"regione": "calabria"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify Calabria IRAP rate
        assert data["irap"]["regione"] == "calabria"
        assert data["irap"]["aliquota"] == 3.9
        print(f"✓ Calabria IRAP rate: {data['irap']['aliquota']}%")
    
    def test_calcolo_imposte_campania(self):
        """Test: Calculate taxes for Campania region (IRAP 4.97%)"""
        response = requests.get(
            f"{BASE_URL}/api/contabilita/calcolo-imposte",
            params={"regione": "campania"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify Campania IRAP rate
        assert data["irap"]["regione"] == "campania"
        assert data["irap"]["aliquota"] == 4.97
        print(f"✓ Campania IRAP rate: {data['irap']['aliquota']}%")
    
    def test_calcolo_imposte_variazioni_fiscali(self):
        """Test: Verify fiscal variations are calculated (telefonia 20% non-deducible)"""
        response = requests.get(f"{BASE_URL}/api/contabilita/calcolo-imposte")
        assert response.status_code == 200
        data = response.json()
        
        # Check if there are variations
        variazioni = data["ires"]["variazioni_aumento"]
        print(f"✓ Variazioni in aumento IRES: {len(variazioni)}")
        for v in variazioni:
            print(f"  - {v['descrizione']}: €{v['importo']}")


class TestStatisticheCategorizzazione:
    """Test categorization statistics endpoint"""
    
    def test_get_statistiche_categorizzazione(self):
        """Test: Get categorization statistics"""
        response = requests.get(f"{BASE_URL}/api/contabilita/statistiche-categorizzazione")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "distribuzione_categorie" in data
        assert "totale_categorizzate" in data
        assert "totale_non_categorizzate" in data
        assert "percentuale_copertura" in data
        
        print(f"✓ Statistiche: {data['totale_categorizzate']} categorizzate, {data['totale_non_categorizzate']} non categorizzate")
        print(f"  Copertura: {data['percentuale_copertura']}%")
        
        # Show distribution
        if data["distribuzione_categorie"]:
            print("  Distribuzione categorie:")
            for cat in data["distribuzione_categorie"][:5]:
                print(f"    - {cat['categoria']}: {cat['numero_fatture']} fatture, €{cat['importo_totale']}")


class TestBilancioDettagliato:
    """Test detailed balance sheet endpoint"""
    
    def test_get_bilancio_dettagliato(self):
        """Test: Get detailed balance sheet with Conto Economico and Stato Patrimoniale"""
        response = requests.get(f"{BASE_URL}/api/contabilita/bilancio-dettagliato")
        assert response.status_code == 200
        data = response.json()
        
        # Verify Stato Patrimoniale structure
        assert "stato_patrimoniale" in data
        assert "attivo" in data["stato_patrimoniale"]
        assert "passivo" in data["stato_patrimoniale"]
        assert "patrimonio_netto" in data["stato_patrimoniale"]
        
        # Verify Conto Economico structure
        assert "conto_economico" in data
        assert "ricavi" in data["conto_economico"]
        assert "costi" in data["conto_economico"]
        assert "utile_ante_imposte" in data["conto_economico"]
        
        # Verify deducibility info in costs
        costi = data["conto_economico"]["costi"]
        assert "totale_deducibile_ires" in costi
        assert "totale_deducibile_irap" in costi
        
        print(f"✓ Bilancio dettagliato:")
        print(f"  Ricavi totali: €{data['conto_economico']['ricavi']['totale']}")
        print(f"  Costi totali: €{data['conto_economico']['costi']['totale']}")
        print(f"  Utile ante imposte: €{data['conto_economico']['utile_ante_imposte']}")
        print(f"  Costi deducibili IRES: €{costi['totale_deducibile_ires']}")
        print(f"  Costi deducibili IRAP: €{costi['totale_deducibile_irap']}")
    
    def test_bilancio_voci_con_deducibilita(self):
        """Test: Verify cost items have deducibility info"""
        response = requests.get(f"{BASE_URL}/api/contabilita/bilancio-dettagliato")
        assert response.status_code == 200
        data = response.json()
        
        voci_costi = data["conto_economico"]["costi"]["voci"]
        
        # Check that cost items have deducibility fields
        for voce in voci_costi[:5]:
            assert "deducibilita_ires" in voce
            assert "deducibilita_irap" in voce
            if voce["saldo"] > 0:
                print(f"  {voce['codice']} - {voce['nome']}: €{voce['saldo']} (IRES {voce['deducibilita_ires']}%, IRAP {voce['deducibilita_irap']}%)")


class TestInizializzaPianoEsteso:
    """Test extended chart of accounts initialization"""
    
    def test_inizializza_piano_esteso(self):
        """Test: Initialize/update extended chart of accounts"""
        response = requests.post(f"{BASE_URL}/api/contabilita/inizializza-piano-esteso")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert data["success"] == True
        assert "conti_aggiunti" in data
        assert "conti_aggiornati" in data
        assert "totale_piano_conti" in data
        
        print(f"✓ Piano dei Conti inizializzato:")
        print(f"  Conti aggiunti: {data['conti_aggiunti']}")
        print(f"  Conti aggiornati: {data['conti_aggiornati']}")
        print(f"  Totale conti: {data['totale_piano_conti']}")


class TestAliquoteIRAP:
    """Test IRAP rates endpoint"""
    
    def test_get_aliquote_irap(self):
        """Test: Get IRAP rates for all regions"""
        response = requests.get(f"{BASE_URL}/api/contabilita/aliquote-irap")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "aliquote" in data
        assert "nota" in data
        
        aliquote = data["aliquote"]
        
        # Verify specific regions
        assert "calabria" in aliquote
        assert aliquote["calabria"] == 3.9
        
        assert "campania" in aliquote
        assert aliquote["campania"] == 4.97
        
        assert "lombardia" in aliquote
        assert aliquote["lombardia"] == 3.9
        
        assert "trentino_alto_adige" in aliquote
        assert aliquote["trentino_alto_adige"] == 2.68
        
        print(f"✓ Aliquote IRAP per {len(aliquote)} regioni")
        print(f"  Calabria: {aliquote['calabria']}%")
        print(f"  Campania: {aliquote['campania']}%")
        print(f"  Lombardia: {aliquote['lombardia']}%")


class TestPianoContiEsteso:
    """Test extended chart of accounts endpoint"""
    
    def test_get_piano_conti_esteso(self):
        """Test: Get extended chart of accounts"""
        response = requests.get(f"{BASE_URL}/api/contabilita/piano-conti-esteso")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "conti" in data
        assert "grouped" in data
        assert "totale_conti" in data
        
        # Verify grouping
        grouped = data["grouped"]
        assert "attivo" in grouped or "costi" in grouped or "ricavi" in grouped
        
        print(f"✓ Piano dei Conti esteso: {data['totale_conti']} conti")
        print(f"  Conti nuovi: {data.get('conti_nuovi', 0)}")
        
        # Show categories
        for cat, conti in grouped.items():
            print(f"  {cat}: {len(conti)} conti")


class TestIntegration:
    """Integration tests for the complete flow"""
    
    def test_full_categorization_flow(self):
        """Test: Full categorization and tax calculation flow"""
        # 1. Test categorization of different products
        test_products = [
            ("LIMONCELLO 30%", "bevande_alcoliche", "05.01.03", 100),
            ("TIM Wi-Fi", "telefonia", "05.02.07", 80),
            ("Benzina", "carburante", "05.02.11", 100),
            ("Google Workspace", "software_cloud", "05.02.08", 100),
        ]
        
        for desc, expected_cat, expected_conto, expected_ded in test_products:
            response = requests.get(
                f"{BASE_URL}/api/contabilita/categorizzazione-preview",
                params={"descrizione": desc}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["categorizzazione"]["categoria_merceologica"] == expected_cat
            assert data["categorizzazione"]["conto_codice"] == expected_conto
            assert data["categorizzazione"]["deducibilita_ires"] == expected_ded
        
        print("✓ All categorizations correct")
        
        # 2. Get tax calculation
        response = requests.get(
            f"{BASE_URL}/api/contabilita/calcolo-imposte",
            params={"regione": "calabria"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify IRES is 24%
        assert data["ires"]["aliquota"] == 24.0
        # Verify IRAP Calabria is 3.9%
        assert data["irap"]["aliquota"] == 3.9
        
        print(f"✓ Tax calculation correct - IRES 24%, IRAP Calabria 3.9%")
        print(f"  Total taxes: €{data['totale_imposte']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
