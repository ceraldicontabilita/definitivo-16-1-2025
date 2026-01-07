import json
import re
import pandas as pd
from pathlib import Path

# Dati estratti dai PDF - Q1 2023
q1_data = [
  {"Data Operazione": "31/12/22", "Data Valuta": "02/01/23", "Descrizione": "SALDO INIZIALE A VOSTRO CREDITO", "Dare": "", "Avere": "11.376,95"},
  {"Data Operazione": "02/01/23", "Data Valuta": "02/01/23", "Descrizione": "SDD CORE: LEASYS S.P.A.", "Dare": "1.039,73", "Avere": ""},
  {"Data Operazione": "02/01/23", "Data Valuta": "02/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "654,25"},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.000,00"},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "BONIFICO TAIANO LUIGI", "Dare": "1.000,00", "Avere": ""},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "BONIFICO CAPEZZUTO ALESSANDRO", "Dare": "1.000,00", "Avere": ""},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "BONIFICO VESPA VINCENZO", "Dare": "1.000,00", "Avere": ""},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "BONIFICO PARISI ANTONIO", "Dare": "1.000,00", "Avere": ""},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "BONIFICO MOSCATO EMANUELE", "Dare": "800,00", "Avere": ""},
  {"Data Operazione": "04/01/23", "Data Valuta": "04/01/23", "Descrizione": "BONIFICO LIUZZA MARINA", "Dare": "1.300,00", "Avere": ""},
  {"Data Operazione": "11/01/23", "Data Valuta": "11/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "10.000,00"},
  {"Data Operazione": "12/01/23", "Data Valuta": "12/01/23", "Descrizione": "AGENZIA ENTRATE F24", "Dare": "4.827,27", "Avere": ""},
  {"Data Operazione": "16/01/23", "Data Valuta": "16/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.010,00"},
  {"Data Operazione": "17/01/23", "Data Valuta": "17/01/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.886,34", "Avere": ""},
  {"Data Operazione": "18/01/23", "Data Valuta": "16/01/23", "Descrizione": "AGENZIA ENTRATE F24", "Dare": "12.689,40", "Avere": ""},
  {"Data Operazione": "19/01/23", "Data Valuta": "19/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.000,00"},
  {"Data Operazione": "20/01/23", "Data Valuta": "20/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.990,00"},
  {"Data Operazione": "24/01/23", "Data Valuta": "24/01/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "512,92", "Avere": ""},
  {"Data Operazione": "27/01/23", "Data Valuta": "27/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.180,00"},
  {"Data Operazione": "30/01/23", "Data Valuta": "30/01/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "8.000,00"},
  {"Data Operazione": "31/01/23", "Data Valuta": "31/01/23", "Descrizione": "SDD CORE LEASYS", "Dare": "3.350,00", "Avere": ""},
  {"Data Operazione": "15/02/23", "Data Valuta": "15/02/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.555,66"},
  {"Data Operazione": "20/02/23", "Data Valuta": "20/02/23", "Descrizione": "GIROCONTO DA CERALDI GROUP", "Dare": "", "Avere": "3.000,00"},
  {"Data Operazione": "27/02/23", "Data Valuta": "27/02/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.000,00"},
  {"Data Operazione": "28/02/23", "Data Valuta": "28/02/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "9.000,00"},
  {"Data Operazione": "10/03/23", "Data Valuta": "10/03/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.800,00"},
  {"Data Operazione": "14/03/23", "Data Valuta": "14/03/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "6.800,00"},
  {"Data Operazione": "15/03/23", "Data Valuta": "15/03/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.000,00"},
  {"Data Operazione": "16/03/23", "Data Valuta": "16/03/23", "Descrizione": "AGENZIA ENTRATE F24", "Dare": "5.650,32", "Avere": ""},
  {"Data Operazione": "17/03/23", "Data Valuta": "17/02/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.839,42", "Avere": ""},
  {"Data Operazione": "30/03/23", "Data Valuta": "30/03/23", "Descrizione": "BONIFICO CERALDI VINCENZO", "Dare": "2.000,00", "Avere": ""},
  {"Data Operazione": "31/03/23", "Data Valuta": "31/03/23", "Descrizione": "SDD CORE LEASYS", "Dare": "920,88", "Avere": ""},
  {"Data Operazione": "31/03/23", "Data Valuta": "01/04/23", "Descrizione": "SALDO FINALE", "Dare": "", "Avere": "6.536,86"},
]

# Crea DataFrame e salva Excel per Q1
df_q1 = pd.DataFrame(q1_data)
df_q1.to_excel('/app/docs/estratti_conto/Estratto_Q1_2023.xlsx', index=False, engine='openpyxl')
print("Creato: Estratto_Q1_2023.xlsx")

# Q2 2023 - dati semplificati
q2_data = [
  {"Data Operazione": "03/04/23", "Data Valuta": "03/04/23", "Descrizione": "SALDO INIZIALE", "Dare": "", "Avere": "6.536,86"},
  {"Data Operazione": "03/04/23", "Data Valuta": "03/04/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "8.000,00"},
  {"Data Operazione": "03/04/23", "Data Valuta": "03/04/23", "Descrizione": "SDD CORE PAYPAL", "Dare": "642,05", "Avere": ""},
  {"Data Operazione": "11/04/23", "Data Valuta": "11/04/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "8.000,00"},
  {"Data Operazione": "17/04/23", "Data Valuta": "17/04/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "7.000,00"},
  {"Data Operazione": "17/04/23", "Data Valuta": "17/04/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.860,67", "Avere": ""},
  {"Data Operazione": "18/04/23", "Data Valuta": "17/04/23", "Descrizione": "AGENZIA ENTRATE F24", "Dare": "8.488,05", "Avere": ""},
  {"Data Operazione": "21/04/23", "Data Valuta": "21/04/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.260,00"},
  {"Data Operazione": "24/04/23", "Data Valuta": "24/04/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.000,00"},
  {"Data Operazione": "24/04/23", "Data Valuta": "24/04/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "512,88", "Avere": ""},
  {"Data Operazione": "26/04/23", "Data Valuta": "26/04/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.020,00"},
  {"Data Operazione": "26/04/23", "Data Valuta": "26/04/23", "Descrizione": "SDD ENEL ENERGIA", "Dare": "3.118,33", "Avere": ""},
  {"Data Operazione": "02/05/23", "Data Valuta": "02/05/23", "Descrizione": "SDD LEASYS", "Dare": "1.420,88", "Avere": ""},
  {"Data Operazione": "03/05/23", "Data Valuta": "03/05/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.500,00"},
  {"Data Operazione": "09/05/23", "Data Valuta": "09/05/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.700,00"},
  {"Data Operazione": "17/05/23", "Data Valuta": "17/05/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.843,56", "Avere": ""},
  {"Data Operazione": "24/05/23", "Data Valuta": "24/05/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.350,00"},
  {"Data Operazione": "25/05/23", "Data Valuta": "25/05/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.000,00"},
  {"Data Operazione": "01/06/23", "Data Valuta": "31/05/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.400,00"},
  {"Data Operazione": "07/06/23", "Data Valuta": "07/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.980,00"},
  {"Data Operazione": "09/06/23", "Data Valuta": "09/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.000,00"},
  {"Data Operazione": "14/06/23", "Data Valuta": "14/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.650,00"},
  {"Data Operazione": "15/06/23", "Data Valuta": "15/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.560,00"},
  {"Data Operazione": "23/06/23", "Data Valuta": "23/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.510,00"},
  {"Data Operazione": "27/06/23", "Data Valuta": "27/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.510,00"},
  {"Data Operazione": "30/06/23", "Data Valuta": "30/06/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.000,00"},
  {"Data Operazione": "30/06/23", "Data Valuta": "", "Descrizione": "SALDO FINALE", "Dare": "", "Avere": "352,40"},
]
df_q2 = pd.DataFrame(q2_data)
df_q2.to_excel('/app/docs/estratti_conto/Estratto_Q2_2023.xlsx', index=False, engine='openpyxl')
print("Creato: Estratto_Q2_2023.xlsx")

# Q3 2023
q3_data = [
  {"Data Operazione": "30/06/23", "Data Valuta": "03/07/23", "Descrizione": "SALDO INIZIALE", "Dare": "", "Avere": "352,40"},
  {"Data Operazione": "03/07/23", "Data Valuta": "03/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.550,00"},
  {"Data Operazione": "03/07/23", "Data Valuta": "03/07/23", "Descrizione": "SDD ARVAL SERVICE LEASE", "Dare": "770,45", "Avere": ""},
  {"Data Operazione": "03/07/23", "Data Valuta": "03/07/23", "Descrizione": "SDD PAYPAL", "Dare": "824,56", "Avere": ""},
  {"Data Operazione": "04/07/23", "Data Valuta": "03/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.400,00"},
  {"Data Operazione": "07/07/23", "Data Valuta": "07/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.190,00"},
  {"Data Operazione": "12/07/23", "Data Valuta": "12/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.600,00"},
  {"Data Operazione": "14/07/23", "Data Valuta": "14/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.700,00"},
  {"Data Operazione": "14/07/23", "Data Valuta": "14/07/23", "Descrizione": "BONIFICO CERALDI VINCENZO", "Dare": "500,00", "Avere": ""},
  {"Data Operazione": "14/07/23", "Data Valuta": "14/07/23", "Descrizione": "BONIFICO CERALDI VALERIO", "Dare": "500,00", "Avere": ""},
  {"Data Operazione": "17/07/23", "Data Valuta": "17/07/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.826,17", "Avere": ""},
  {"Data Operazione": "19/07/23", "Data Valuta": "19/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.830,00"},
  {"Data Operazione": "24/07/23", "Data Valuta": "24/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.500,00"},
  {"Data Operazione": "24/07/23", "Data Valuta": "24/07/23", "Descrizione": "SDD ENEL ENERGIA", "Dare": "3.933,80", "Avere": ""},
  {"Data Operazione": "24/07/23", "Data Valuta": "24/07/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "512,17", "Avere": ""},
  {"Data Operazione": "25/07/23", "Data Valuta": "25/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.400,00"},
  {"Data Operazione": "28/07/23", "Data Valuta": "28/07/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.350,00"},
  {"Data Operazione": "07/08/23", "Data Valuta": "07/08/23", "Descrizione": "GIROCONTO DA CERALDI GROUP", "Dare": "", "Avere": "13.000,00"},
  {"Data Operazione": "08/08/23", "Data Valuta": "08/08/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.500,00"},
  {"Data Operazione": "09/08/23", "Data Valuta": "09/08/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.000,00"},
  {"Data Operazione": "09/08/23", "Data Valuta": "09/08/23", "Descrizione": "GIROCONTO DA CERALDI GROUP", "Dare": "", "Avere": "10.000,00"},
  {"Data Operazione": "05/09/23", "Data Valuta": "05/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.500,00"},
  {"Data Operazione": "06/09/23", "Data Valuta": "06/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.010,00"},
  {"Data Operazione": "11/09/23", "Data Valuta": "11/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.120,00"},
  {"Data Operazione": "16/09/23", "Data Valuta": "17/09/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.817,89", "Avere": ""},
  {"Data Operazione": "18/09/23", "Data Valuta": "18/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "6.770,00"},
  {"Data Operazione": "20/09/23", "Data Valuta": "20/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.680,00"},
  {"Data Operazione": "25/09/23", "Data Valuta": "25/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.000,00"},
  {"Data Operazione": "26/09/23", "Data Valuta": "26/09/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.710,00"},
  {"Data Operazione": "26/09/23", "Data Valuta": "26/09/23", "Descrizione": "SDD ENEL ENERGIA", "Dare": "2.562,44", "Avere": ""},
  {"Data Operazione": "30/09/23", "Data Valuta": "01/10/23", "Descrizione": "SALDO FINALE", "Dare": "", "Avere": "5.200,28"},
]
df_q3 = pd.DataFrame(q3_data)
df_q3.to_excel('/app/docs/estratti_conto/Estratto_Q3_2023.xlsx', index=False, engine='openpyxl')
print("Creato: Estratto_Q3_2023.xlsx")

# Q4 2023
q4_data = [
  {"Data Operazione": "30/09/23", "Data Valuta": "02/10/23", "Descrizione": "SALDO INIZIALE", "Dare": "", "Avere": "5.200,28"},
  {"Data Operazione": "02/10/23", "Data Valuta": "02/10/23", "Descrizione": "SDD LEASYS", "Dare": "988,38", "Avere": ""},
  {"Data Operazione": "03/10/23", "Data Valuta": "03/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "8.050,00"},
  {"Data Operazione": "04/10/23", "Data Valuta": "04/10/23", "Descrizione": "BONIFICO CERALDI VALERIO", "Dare": "2.000,00", "Avere": ""},
  {"Data Operazione": "04/10/23", "Data Valuta": "04/10/23", "Descrizione": "BONIFICO CERALDI VINCENZO", "Dare": "2.000,00", "Avere": ""},
  {"Data Operazione": "11/10/23", "Data Valuta": "11/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.000,00"},
  {"Data Operazione": "16/10/23", "Data Valuta": "16/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "3.000,00"},
  {"Data Operazione": "17/10/23", "Data Valuta": "17/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.400,00"},
  {"Data Operazione": "18/10/23", "Data Valuta": "18/10/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.801,32", "Avere": ""},
  {"Data Operazione": "24/10/23", "Data Valuta": "24/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.350,00"},
  {"Data Operazione": "24/10/23", "Data Valuta": "24/10/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "512,17", "Avere": ""},
  {"Data Operazione": "27/10/23", "Data Valuta": "27/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.000,00"},
  {"Data Operazione": "30/10/23", "Data Valuta": "30/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.900,00"},
  {"Data Operazione": "02/11/23", "Data Valuta": "31/10/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "2.950,00"},
  {"Data Operazione": "06/11/23", "Data Valuta": "06/11/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.660,00"},
  {"Data Operazione": "08/11/23", "Data Valuta": "08/11/23", "Descrizione": "GIROCONTO DA CERALDI GROUP", "Dare": "", "Avere": "4.000,00"},
  {"Data Operazione": "13/11/23", "Data Valuta": "13/11/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.260,00"},
  {"Data Operazione": "17/11/23", "Data Valuta": "17/11/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.801,00", "Avere": ""},
  {"Data Operazione": "21/11/23", "Data Valuta": "21/11/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.400,00"},
  {"Data Operazione": "23/11/23", "Data Valuta": "23/11/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "1.300,00"},
  {"Data Operazione": "27/11/23", "Data Valuta": "27/11/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "4.980,00"},
  {"Data Operazione": "11/12/23", "Data Valuta": "11/12/23", "Descrizione": "SDD ENEL ENERGIA", "Dare": "1.054,00", "Avere": ""},
  {"Data Operazione": "11/12/23", "Data Valuta": "11/12/23", "Descrizione": "INPS FONDO NUOVE COMPETENZE", "Dare": "", "Avere": "24.549,77"},
  {"Data Operazione": "12/12/23", "Data Valuta": "12/12/23", "Descrizione": "GIROCONTO DA CERALDI GROUP", "Dare": "", "Avere": "40.000,00"},
  {"Data Operazione": "12/12/23", "Data Valuta": "12/12/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "4.801,00", "Avere": ""},
  {"Data Operazione": "19/12/23", "Data Valuta": "18/12/23", "Descrizione": "AGENZIA ENTRATE F24", "Dare": "10.731,05", "Avere": ""},
  {"Data Operazione": "22/12/23", "Data Valuta": "21/12/23", "Descrizione": "BONIFICO CERALDI VALERIO", "Dare": "2.000,00", "Avere": ""},
  {"Data Operazione": "22/12/23", "Data Valuta": "22/12/23", "Descrizione": "BONIFICO CERALDI VINCENZO", "Dare": "2.000,00", "Avere": ""},
  {"Data Operazione": "22/12/23", "Data Valuta": "22/12/23", "Descrizione": "BONIFICO VESPA VINCENZO", "Dare": "2.000,00", "Avere": ""},
  {"Data Operazione": "23/12/23", "Data Valuta": "24/12/23", "Descrizione": "MUTUO N.1788 RATA", "Dare": "512,17", "Avere": ""},
  {"Data Operazione": "27/12/23", "Data Valuta": "27/12/23", "Descrizione": "BONIFICO CERALDI VINCENZO", "Dare": "3.000,00", "Avere": ""},
  {"Data Operazione": "27/12/23", "Data Valuta": "27/12/23", "Descrizione": "BONIFICO SOLLA VINCENZO", "Dare": "144,00", "Avere": ""},
  {"Data Operazione": "27/12/23", "Data Valuta": "27/12/23", "Descrizione": "BONIFICO FIRE SOLUTION GROUP", "Dare": "6.100,00", "Avere": ""},
  {"Data Operazione": "28/12/23", "Data Valuta": "28/12/23", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "8.980,00"},
  {"Data Operazione": "29/12/23", "Data Valuta": "29/12/23", "Descrizione": "AGENZIA ENTRATE F24", "Dare": "14.955,66", "Avere": ""},
  {"Data Operazione": "29/12/23", "Data Valuta": "29/12/23", "Descrizione": "SDD ENEL ENERGIA", "Dare": "3.352,39", "Avere": ""},
  {"Data Operazione": "30/12/23", "Data Valuta": "01/01/24", "Descrizione": "VERSAMENTO CONTANTI", "Dare": "", "Avere": "5.180,00"},
  {"Data Operazione": "31/12/23", "Data Valuta": "", "Descrizione": "SALDO FINALE", "Dare": "", "Avere": "5.554,73"},
]
df_q4 = pd.DataFrame(q4_data)
df_q4.to_excel('/app/docs/estratti_conto/Estratto_Q4_2023.xlsx', index=False, engine='openpyxl')
print("Creato: Estratto_Q4_2023.xlsx")

print("\nTutti i file Excel sono stati creati!")
print("Percorso: /app/docs/estratti_conto/")
