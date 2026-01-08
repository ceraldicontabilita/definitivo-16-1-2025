"""
Test suite for new ERP features:
1. POS Accredito - Logica sfasamento accrediti POS
2. Magazzino - Popolare Magazzino da Fatture XML
3. Bilancio - Confronto anno su anno
4. Dashboard - Trend mensili
"""
import pytest
import requests
import os
from datetime import date, datetime

# Use the public URL from frontend/.env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dipendenti-fix.preview.emergentagent.com').rstrip('/')


class TestPOSAccredito:
    """Test POS Accredito endpoints - calcolo sfasamento e festivi italiani"""
    
    def test_calcola_accredito_monday(self):
        """Test calcolo accredito per pagamento di Lunedì (2025-01-06)"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calcola-accredito", params={
            "data_pagamento": "2025-01-06"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "data_pagamento" in data
        assert "data_accredito" in data
        assert "giorno_pagamento" in data
        assert "giorno_accredito" in data
        assert "giorni_sfasamento" in data
        assert "note" in data
        
        # 2025-01-06 is Monday, so accredito should be Tuesday 2025-01-07
        assert data["data_pagamento"] == "2025-01-06"
        assert data["giorno_pagamento"] == "Lunedì"
        # Accredito should be next business day (Tuesday)
        assert data["data_accredito"] == "2025-01-07"
        assert data["giorno_accredito"] == "Martedì"
        assert data["giorni_sfasamento"] == 1
        print(f"✅ Calcolo accredito Lunedì: {data}")
    
    def test_calcola_accredito_friday(self):
        """Test calcolo accredito per pagamento di Venerdì"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calcola-accredito", params={
            "data_pagamento": "2025-01-10"  # Friday
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["giorno_pagamento"] == "Venerdì"
        # Friday payment -> Monday accredito (+3 days)
        assert data["data_accredito"] == "2025-01-13"
        assert data["giorno_accredito"] == "Lunedì"
        assert data["giorni_sfasamento"] == 3
        print(f"✅ Calcolo accredito Venerdì: {data}")
    
    def test_calcola_accredito_saturday(self):
        """Test calcolo accredito per pagamento di Sabato"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calcola-accredito", params={
            "data_pagamento": "2025-01-11"  # Saturday
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["giorno_pagamento"] == "Sabato"
        # Saturday payment -> Tuesday accredito (+3 days)
        assert data["data_accredito"] == "2025-01-14"
        assert data["giorno_accredito"] == "Martedì"
        assert data["giorni_sfasamento"] == 3
        print(f"✅ Calcolo accredito Sabato: {data}")
    
    def test_calcola_accredito_sunday(self):
        """Test calcolo accredito per pagamento di Domenica"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calcola-accredito", params={
            "data_pagamento": "2025-01-12"  # Sunday
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["giorno_pagamento"] == "Domenica"
        # Sunday payment -> Tuesday accredito (+2 days)
        assert data["data_accredito"] == "2025-01-14"
        assert data["giorno_accredito"] == "Martedì"
        assert data["giorni_sfasamento"] == 2
        print(f"✅ Calcolo accredito Domenica: {data}")
    
    def test_calcola_accredito_invalid_date(self):
        """Test calcolo accredito con data non valida"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calcola-accredito", params={
            "data_pagamento": "invalid-date"
        })
        assert response.status_code == 400
        print(f"✅ Validazione data non valida: {response.json()}")
    
    def test_festivi_2025(self):
        """Test lista festivi italiani 2025 - deve restituire 12 festivi"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/festivi/2025")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "anno" in data
        assert "festivi" in data
        assert "totale" in data
        
        assert data["anno"] == 2025
        assert data["totale"] == 12, f"Expected 12 festivi, got {data['totale']}"
        
        # Verify festivi structure
        festivi = data["festivi"]
        assert len(festivi) == 12
        
        # Check each festivo has required fields
        for festivo in festivi:
            assert "data" in festivo
            assert "giorno" in festivo
            assert "nome" in festivo
        
        # Verify specific festivi names
        nomi_festivi = [f["nome"] for f in festivi]
        expected_names = [
            "Capodanno", "Epifania", "Festa della Liberazione", 
            "Festa dei Lavoratori", "Festa della Repubblica", "Ferragosto",
            "Ognissanti", "Immacolata Concezione", "Natale", "Santo Stefano",
            "Pasqua", "Lunedì dell'Angelo (Pasquetta)"
        ]
        
        for name in expected_names:
            assert name in nomi_festivi, f"Missing festivo: {name}"
        
        print(f"✅ Festivi 2025: {data['totale']} festivi trovati")
        for f in festivi:
            print(f"   - {f['data']} ({f['giorno']}): {f['nome']}")
    
    def test_calendario_mensile_gennaio_2025(self):
        """Test calendario mensile con sfasamento per gennaio 2025"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calendario-mensile/2025/1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "anno" in data
        assert "mese" in data
        assert "festivi" in data
        assert "giorni" in data
        assert "legenda" in data
        
        assert data["anno"] == 2025
        assert data["mese"] == 1
        
        # January 2025 has 31 days
        assert len(data["giorni"]) == 31
        
        # Check each day has required fields
        for giorno in data["giorni"]:
            assert "data_pagamento" in giorno
            assert "data_accredito" in giorno
            assert "giorno_settimana_pagamento" in giorno
            assert "giorni_sfasamento" in giorno
            assert "note" in giorno
        
        # Verify festivi in January (Capodanno 1/1, Epifania 6/1)
        assert "2025-01-01" in data["festivi"]
        assert "2025-01-06" in data["festivi"]
        
        print(f"✅ Calendario mensile Gennaio 2025: {len(data['giorni'])} giorni")
        print(f"   Festivi nel mese: {data['festivi']}")
    
    def test_calendario_mensile_invalid_month(self):
        """Test calendario mensile con mese non valido"""
        response = requests.get(f"{BASE_URL}/api/pos-accredito/calendario-mensile/2025/13")
        assert response.status_code == 400
        print(f"✅ Validazione mese non valido: {response.json()}")


class TestMagazzinoCatalogo:
    """Test Magazzino endpoints - catalogo e popolamento da fatture"""
    
    def test_get_catalogo_prodotti(self):
        """Test GET catalogo prodotti - può essere vuoto"""
        response = requests.get(f"{BASE_URL}/api/magazzino/catalogo")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "prodotti" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "categorie_disponibili" in data
        
        # prodotti can be empty list
        assert isinstance(data["prodotti"], list)
        assert isinstance(data["total"], int)
        
        print(f"✅ Catalogo prodotti: {data['total']} prodotti trovati")
        if data["prodotti"]:
            print(f"   Categorie: {data['categorie_disponibili']}")
    
    def test_popola_da_fatture_dry_run(self):
        """Test popolamento magazzino da fatture XML in dry_run mode"""
        response = requests.post(f"{BASE_URL}/api/magazzino/popola-da-fatture", params={
            "dry_run": True
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "dry_run" in data
        assert "fatture_analizzate" in data
        assert "prodotti_estratti" in data
        assert "prodotti_creati" in data
        assert "prodotti_aggiornati" in data
        assert "errori" in data
        
        # In dry_run mode, no products should be created
        assert data["dry_run"] == True
        assert data["prodotti_creati"] == 0
        assert data["prodotti_aggiornati"] == 0
        
        print(f"✅ Popola da fatture (dry_run): {data['fatture_analizzate']} fatture analizzate")
        print(f"   Prodotti estratti: {data['prodotti_estratti']}")
        if data.get("anteprima_prodotti"):
            print(f"   Anteprima primi prodotti: {len(data['anteprima_prodotti'])}")
    
    def test_popola_da_fatture_dry_run_with_anno(self):
        """Test popolamento magazzino con filtro anno"""
        response = requests.post(f"{BASE_URL}/api/magazzino/popola-da-fatture", params={
            "dry_run": True,
            "anno": 2025
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["dry_run"] == True
        print(f"✅ Popola da fatture (dry_run, anno=2025): {data['fatture_analizzate']} fatture")


class TestBilancioConfrontoAnnuale:
    """Test Bilancio endpoints - confronto anno su anno"""
    
    def test_confronto_annuale_2025(self):
        """Test confronto annuale bilancio 2025 vs 2024"""
        response = requests.get(f"{BASE_URL}/api/bilancio/confronto-annuale", params={
            "anno_corrente": 2025
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "anno_corrente" in data
        assert "anno_precedente" in data
        assert "conto_economico" in data
        assert "stato_patrimoniale" in data
        assert "kpi" in data
        assert "sintesi" in data
        
        assert data["anno_corrente"] == 2025
        assert data["anno_precedente"] == 2024
        
        # Verify conto_economico structure
        ce = data["conto_economico"]
        assert "ricavi" in ce
        assert "costi" in ce
        assert "risultato" in ce
        
        # Verify ricavi structure
        assert "corrispettivi" in ce["ricavi"]
        assert "altri_ricavi" in ce["ricavi"]
        assert "totale_ricavi" in ce["ricavi"]
        
        # Verify each variazione has required fields
        for key in ["corrispettivi", "altri_ricavi", "totale_ricavi"]:
            variazione = ce["ricavi"][key]
            assert "attuale" in variazione
            assert "precedente" in variazione
            assert "variazione" in variazione
            assert "variazione_pct" in variazione
            assert "trend" in variazione
        
        # Verify stato_patrimoniale structure
        sp = data["stato_patrimoniale"]
        assert "attivo" in sp
        assert "passivo" in sp
        
        # Verify KPI structure
        kpi = data["kpi"]
        assert "margine_lordo_pct" in kpi
        assert "roi_pct" in kpi
        assert "crescita_ricavi_pct" in kpi
        assert "crescita_costi_pct" in kpi
        
        # Verify sintesi structure
        sintesi = data["sintesi"]
        assert "ricavi_trend" in sintesi
        assert "utile_trend" in sintesi
        assert "liquidita_trend" in sintesi
        
        print(f"✅ Confronto annuale 2025 vs 2024:")
        print(f"   Ricavi trend: {sintesi['ricavi_trend']}")
        print(f"   Utile trend: {sintesi['utile_trend']}")
        print(f"   Liquidità trend: {sintesi['liquidita_trend']}")
        print(f"   Crescita ricavi: {kpi['crescita_ricavi_pct']}%")
    
    def test_confronto_annuale_custom_years(self):
        """Test confronto annuale con anni personalizzati"""
        response = requests.get(f"{BASE_URL}/api/bilancio/confronto-annuale", params={
            "anno_corrente": 2024,
            "anno_precedente": 2023
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["anno_corrente"] == 2024
        assert data["anno_precedente"] == 2023
        print(f"✅ Confronto annuale 2024 vs 2023: OK")


class TestDashboardTrendMensile:
    """Test Dashboard endpoints - trend mensili"""
    
    def test_trend_mensile_2025(self):
        """Test trend mensile per anno 2025 - deve restituire 12 mesi"""
        response = requests.get(f"{BASE_URL}/api/dashboard/trend-mensile", params={
            "anno": 2025
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "anno" in data
        assert "trend_mensile" in data
        assert "totali" in data
        assert "statistiche" in data
        assert "chart_data" in data
        
        assert data["anno"] == 2025
        
        # Verify trend_mensile has 12 months
        trend = data["trend_mensile"]
        assert len(trend) == 12, f"Expected 12 months, got {len(trend)}"
        
        # Verify each month has required fields
        mesi_nomi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
        for i, mese in enumerate(trend):
            assert "mese" in mese
            assert "mese_nome" in mese
            assert "entrate" in mese
            assert "uscite" in mese
            assert "saldo" in mese
            assert "iva_debito" in mese
            assert "iva_credito" in mese
            assert "saldo_iva" in mese
            
            assert mese["mese"] == i + 1
            assert mese["mese_nome"] == mesi_nomi[i]
        
        # Verify totali structure
        totali = data["totali"]
        assert "entrate" in totali
        assert "uscite" in totali
        assert "saldo" in totali
        assert "iva_debito" in totali
        assert "iva_credito" in totali
        assert "saldo_iva" in totali
        
        # Verify statistiche structure
        stats = data["statistiche"]
        assert "media_entrate_mensile" in stats
        assert "media_uscite_mensile" in stats
        assert "mese_picco_entrate" in stats
        assert "mese_picco_uscite" in stats
        assert "mesi_con_dati" in stats
        
        # Verify chart_data structure
        chart = data["chart_data"]
        assert "labels" in chart
        assert "entrate" in chart
        assert "uscite" in chart
        assert "saldo" in chart
        assert len(chart["labels"]) == 12
        assert len(chart["entrate"]) == 12
        assert len(chart["uscite"]) == 12
        assert len(chart["saldo"]) == 12
        
        print(f"✅ Trend mensile 2025:")
        print(f"   Totale entrate: €{totali['entrate']:,.2f}")
        print(f"   Totale uscite: €{totali['uscite']:,.2f}")
        print(f"   Saldo: €{totali['saldo']:,.2f}")
        print(f"   Mese picco entrate: {stats['mese_picco_entrate']}")
        print(f"   Mese picco uscite: {stats['mese_picco_uscite']}")
    
    def test_trend_mensile_default_year(self):
        """Test trend mensile senza specificare anno (usa anno corrente)"""
        response = requests.get(f"{BASE_URL}/api/dashboard/trend-mensile")
        assert response.status_code == 200
        
        data = response.json()
        current_year = datetime.now().year
        assert data["anno"] == current_year
        assert len(data["trend_mensile"]) == 12
        print(f"✅ Trend mensile anno corrente ({current_year}): OK")


class TestAPIHealthCheck:
    """Quick health check for all new endpoints"""
    
    def test_all_endpoints_accessible(self):
        """Verify all new endpoints are accessible"""
        endpoints = [
            ("GET", "/api/pos-accredito/calcola-accredito?data_pagamento=2025-01-06"),
            ("GET", "/api/pos-accredito/festivi/2025"),
            ("GET", "/api/pos-accredito/calendario-mensile/2025/1"),
            ("GET", "/api/magazzino/catalogo"),
            ("POST", "/api/magazzino/popola-da-fatture?dry_run=true"),
            ("GET", "/api/bilancio/confronto-annuale?anno_corrente=2025"),
            ("GET", "/api/dashboard/trend-mensile?anno=2025"),
        ]
        
        results = []
        for method, endpoint in endpoints:
            url = f"{BASE_URL}{endpoint}"
            if method == "GET":
                response = requests.get(url)
            else:
                response = requests.post(url)
            
            status = "✅" if response.status_code == 200 else "❌"
            results.append((endpoint, response.status_code, status))
            print(f"{status} {method} {endpoint}: {response.status_code}")
        
        # All should return 200
        failed = [r for r in results if r[1] != 200]
        assert len(failed) == 0, f"Failed endpoints: {failed}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
