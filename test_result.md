#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "1) Risolvere Issue P0 dropdown dipendenti vuoto. 2) Completare Previsioni Acquisti. 3) Integrare assegni multipli. 4) Refactoring eliminazione codice duplicato."

frontend:
  - task: "Dropdown Dipendenti in Contratti e Libretti"
    implemented: true
    working: true
    file: "frontend/src/components/dipendenti/ContrattiTab.jsx, LibrettiSanitariTab.jsx"
    priority: "critical"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Issue P0 RISOLTA: i tab usano React Query per caricare dipendenti indipendentemente. Dropdown ora ha 23 opzioni (22 dipendenti + placeholder)"

  - task: "Pagina Previsioni Acquisti"
    implemented: true
    working: true
    file: "frontend/src/pages/PrevisioniAcquisti.jsx"
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "3 metodologie implementate: medie giornaliere/settimanali, confronto anno corrente vs precedente con trend, previsioni acquisti con costo stimato"

backend:
  - task: "Refactoring Router Backend"
    implemented: true
    working: true
    file: "app/routers/"
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "REFACTORING COMPLETATO: Eliminati 58 file duplicati dalla root. Struttura organizzata in sottocartelle (accounting/, bank/, employees/, f24/, haccp/, invoices/, reports/, warehouse/). Tutte le API testate e funzionanti."

  - task: "Logica Assegni Multipli"
    implemented: true
    working: true
    file: "app/services/aruba_invoice_parser.py, app/routers/operazioni_da_confermare.py"
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Logica già presente e integrata: find_multiple_checks_match() cerca combinazioni 2-4 assegni. Endpoint conferma gestisce assegni multipli (linee 209-232). Status 'da_verificare' per casi dubbi."

metadata:
  created_by: "main_agent"
  version: "7.0"
  test_sequence: 7
  run_ui: true

test_plan:
  current_focus:
    - "Test completo dopo refactoring: tutte le funzionalità principali"
  test_all: true

agent_communication:
  - agent: "main"
    message: "COMPLETATI 4 TASK: 1) Issue P0 dropdown dipendenti RISOLTO. 2) Previsioni Acquisti COMPLETO. 3) Assegni multipli GIÀ INTEGRATI. 4) REFACTORING: eliminati 58 file duplicati. TEST DA FARE: A) /dipendenti - tab Contratti - Nuovo Contratto - verifica dropdown 23 opzioni. B) /previsioni-acquisti - verifica statistiche 2025 e tab previsioni. C) API principali funzionanti (già testate via curl). D) Verifica che non ci siano regressioni su altre pagine (fatture, haccp, prima nota)."
  - agent: "testing"
    message: "✅ BACKEND TESTING COMPLETATO - TUTTI I TEST SUPERATI! Testati 12 endpoint principali dopo refactoring: 1) Dipendenti API (22 dipendenti) ✅ 2) Fatture API 2025 ✅ 3) Prima Nota Cassa/Banca 2025 ✅ 4) Estratto Conto 2025 ✅ 5) Operazioni da Confermare 2025 ✅ 6) Previsioni Acquisti (statistiche + previsioni) ✅ 7) Assegni API ✅ 8) HACCP Temperature ✅ 9) F24 Public Models ✅ 10) Health Check ✅. SUCCESS RATE: 100%. Il refactoring con eliminazione 58 file duplicati NON ha causato regressioni. Tutte le API principali funzionano correttamente con la nuova struttura modulare (accounting/, bank/, employees/, f24/, haccp/, invoices/, reports/, warehouse/)."