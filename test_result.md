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

user_problem_statement: "I saldi non funzionano con il bottone ricalcola neanche con i bottoni 2018 2019 2020 2021 2022"

backend:
  - task: "Ricalcola progressivi API"
    implemented: true
    working: true
    file: "app/routers/accounting/prima_nota_salari.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "API endpoint /api/prima-nota-salari/ricalcola-progressivi funziona - testato con curl"

frontend:
  - task: "Bottoni esclusione anni 2018-2022"
    implemented: true
    working: true
    file: "frontend/src/pages/GestioneDipendenti.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "user"
        comment: "Utente ha segnalato che i saldi non funzionano con i bottoni 2018-2022"
      - working: true
        agent: "main"
        comment: "Bug corretto: sostituito API_BASE_URL (variabile non definita) con api.post() - testato con screenshot, bottoni funzionano visivamente"
      - working: true
        agent: "testing"
        comment: "✅ TESTATO CON PLAYWRIGHT: Bottoni 2018-2022 funzionano perfettamente. Visual state cambia correttamente (rosso con strikethrough quando selezionati). Reset button funziona. API calls vengono eseguite senza errori JavaScript. Ricalcolo progressivi funziona."

  - task: "Modale Aggiusta Saldo chiusura"
    implemented: true
    working: true
    file: "frontend/src/pages/GestioneDipendenti.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "user"
        comment: "Utente ha segnalato che la finestra aggiusto saldo non si chiude"
      - working: true
        agent: "testing"
        comment: "✅ TESTATO CON PLAYWRIGHT: Modal Aggiustamento Saldo funziona correttamente. Si apre cliccando il bottone verde 'Aggiustamento Saldo', si chiude correttamente con il bottone 'Annulla'. Modal non si chiude cliccando fuori (comportamento corretto per evitare perdita dati). Tutti i form fields sono presenti e funzionali."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Bottoni esclusione anni 2018-2022"
    - "Modale Aggiusta Saldo chiusura"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Ho corretto il bug dei bottoni anni 2018-2022. Il problema era che il codice usava API_BASE_URL che non era definito. Ho sostituito le chiamate fetch con api.post(). Testa i seguenti scenari: 1) Clicca sui bottoni 2018-2022 e verifica che il ricalcolo avvenga senza errori nella console, 2) Verifica che il modale Aggiusta Saldo si apra cliccando sul bottone verde '+Aggiustamento Saldo' e si chiuda cliccando 'Annulla'"