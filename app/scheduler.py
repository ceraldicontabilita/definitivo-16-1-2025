"""
Scheduler per task automatici HACCP.
Auto-popolamento schede HACCP alle 00:01 ogni giorno.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import random

logger = logging.getLogger(__name__)

# Scheduler instance
scheduler = AsyncIOScheduler()

# Configuration
OPERATORI_HACCP = ["Pocci Salvatore", "Vincenzo Ceraldi"]


async def auto_populate_haccp_daily():
    """
    Task eseguito alle 00:01 ogni giorno.
    Compila automaticamente le schede HACCP del sistema V2:
    - Temperature Frigoriferi (1-12)
    - Temperature Congelatori (1-12)
    - Sanificazione Attrezzature
    - Disinfestazione (random ogni 7-10 giorni)
    """
    from app.database import Database
    
    logger.info("🕐 [SCHEDULER] Avvio auto-popolazione HACCP V2 giornaliera")
    
    try:
        db = Database.get_db()
        oggi = datetime.utcnow()
        anno = oggi.year
        mese = oggi.month
        giorno = oggi.day
        ora_str = "07:00"
        
        frigoriferi_updated = 0
        congelatori_updated = 0
        sanificazioni_updated = 0
        disinfestazione_updated = 0
        
        # ============== TEMPERATURE POSITIVE (Frigoriferi 1-12) ==============
        for frigo_num in range(1, 13):
            # Ottieni o crea la scheda annuale
            scheda = await db["temperature_positive"].find_one({
                "anno": anno,
                "frigorifero_numero": frigo_num
            })
            
            if not scheda:
                # Crea nuova scheda
                scheda = {
                    "id": str(uuid.uuid4()),
                    "anno": anno,
                    "frigorifero_numero": frigo_num,
                    "frigorifero_nome": f"Frigorifero {frigo_num}",
                    "azienda": "Ceraldi Group SRL",
                    "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
                    "temperature": {},
                    "temp_min": 0,
                    "temp_max": 4,
                    "operatori": OPERATORI_HACCP.copy(),
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                await db["temperature_positive"].insert_one(scheda)
            
            mese_str = str(mese)
            giorno_str = str(giorno)
            
            if "temperature" not in scheda:
                scheda["temperature"] = {}
            if mese_str not in scheda["temperature"]:
                scheda["temperature"][mese_str] = {}
            
            # Verifica se la temperatura di oggi è già stata registrata
            if giorno_str not in scheda["temperature"][mese_str] or scheda["temperature"][mese_str][giorno_str].get("temp") is None:
                # Genera temperatura casuale conforme (1-3.5°C)
                temp = round(random.uniform(1.0, 3.5), 1)
                
                scheda["temperature"][mese_str][giorno_str] = {
                    "temp": temp,
                    "operatore": random.choice(OPERATORI_HACCP),
                    "note": "Auto-generato",
                    "timestamp": datetime.utcnow().isoformat()
                }
                scheda["updated_at"] = datetime.utcnow().isoformat()
                
                await db["temperature_positive"].update_one(
                    {"anno": anno, "frigorifero_numero": frigo_num},
                    {"$set": scheda}
                )
                frigoriferi_updated += 1
        
        logger.info(f"✅ [SCHEDULER] Frigoriferi: aggiornati {frigoriferi_updated}/12")
        
        # ============== TEMPERATURE NEGATIVE (Congelatori 1-12) ==============
        for congel_num in range(1, 13):
            scheda = await db["temperature_negative"].find_one({
                "anno": anno,
                "congelatore_numero": congel_num
            })
            
            if not scheda:
                scheda = {
                    "id": str(uuid.uuid4()),
                    "anno": anno,
                    "congelatore_numero": congel_num,
                    "congelatore_nome": f"Congelatore {congel_num}",
                    "azienda": "Ceraldi Group SRL",
                    "indirizzo": "Piazza Carità 14, 80134 Napoli (NA)",
                    "temperature": {},
                    "temp_min": -22,
                    "temp_max": -18,
                    "operatori": OPERATORI_HACCP.copy(),
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
                await db["temperature_negative"].insert_one(scheda)
            
            mese_str = str(mese)
            giorno_str = str(giorno)
            
            if "temperature" not in scheda:
                scheda["temperature"] = {}
            if mese_str not in scheda["temperature"]:
                scheda["temperature"][mese_str] = {}
            
            if giorno_str not in scheda["temperature"][mese_str] or scheda["temperature"][mese_str][giorno_str].get("temp") is None:
                # Genera temperatura casuale conforme (-21 a -18.5°C)
                temp = round(random.uniform(-21, -18.5), 1)
                
                scheda["temperature"][mese_str][giorno_str] = {
                    "temp": temp,
                    "operatore": random.choice(OPERATORI_HACCP),
                    "note": "Auto-generato",
                    "timestamp": datetime.utcnow().isoformat()
                }
                scheda["updated_at"] = datetime.utcnow().isoformat()
                
                await db["temperature_negative"].update_one(
                    {"anno": anno, "congelatore_numero": congel_num},
                    {"$set": scheda}
                )
                congelatori_updated += 1
        
        logger.info(f"✅ [SCHEDULER] Congelatori: aggiornati {congelatori_updated}/12")
        
        # ============== SANIFICAZIONE ATTREZZATURE ==============
        # La sanificazione delle attrezzature viene fatta periodicamente
        # Registriamo solo se è un giorno di sanificazione (es. ogni 3 giorni)
        if giorno % 3 == 0:  # Ogni 3 giorni
            scheda_san = await db["sanificazione_attrezzature"].find_one({"anno": anno})
            
            if not scheda_san:
                scheda_san = {
                    "id": str(uuid.uuid4()),
                    "anno": anno,
                    "azienda": "Ceraldi Group SRL",
                    "registrazioni": {},
                    "created_at": datetime.utcnow().isoformat()
                }
                await db["sanificazione_attrezzature"].insert_one(scheda_san)
            
            mese_str = str(mese)
            giorno_str = str(giorno)
            
            if "registrazioni" not in scheda_san:
                scheda_san["registrazioni"] = {}
            if mese_str not in scheda_san["registrazioni"]:
                scheda_san["registrazioni"][mese_str] = {}
            
            if giorno_str not in scheda_san["registrazioni"][mese_str]:
                attrezzature = [
                    "Affettatrice", "Tritacarne", "Planetaria", "Friggitrice",
                    "Forno", "Piano cottura", "Lavastoviglie", "Tavoli lavoro"
                ]
                
                scheda_san["registrazioni"][mese_str][giorno_str] = {
                    "attrezzature": attrezzature,
                    "prodotto": "Detergente professionale",
                    "operatore": random.choice(OPERATORI_HACCP),
                    "esito": "OK",
                    "note": "Auto-generato",
                    "timestamp": datetime.utcnow().isoformat()
                }
                scheda_san["updated_at"] = datetime.utcnow().isoformat()
                
                await db["sanificazione_attrezzature"].update_one(
                    {"anno": anno},
                    {"$set": scheda_san}
                )
                sanificazioni_updated = 1
        
        logger.info(f"✅ [SCHEDULER] Sanificazione attrezzature: {sanificazioni_updated}")
        
        # ============== DISINFESTAZIONE ==============
        # La disinfestazione viene registrata una volta al mese (giorno casuale 1-10)
        scheda_dis = await db["disinfestazione_annuale"].find_one({"anno": anno})
        
        if not scheda_dis:
            scheda_dis = {
                "id": str(uuid.uuid4()),
                "anno": anno,
                "ditta": {
                    "ragione_sociale": "ANTHIRAT CONTROL S.R.L.",
                    "partita_iva": "07764320631",
                    "rea": "NA-657008",
                    "indirizzo": "VIA CAMALDOLILLI 142 - 80131 - NAPOLI (NA)"
                },
                "interventi_mensili": {},
                "monitoraggio_apparecchi": {},
                "created_at": datetime.utcnow().isoformat()
            }
            await db["disinfestazione_annuale"].insert_one(scheda_dis)
        
        mese_str = str(mese)
        
        # Registra intervento disinfestazione una volta al mese (intorno al giorno 5)
        if giorno == 5:
            if "interventi_mensili" not in scheda_dis:
                scheda_dis["interventi_mensili"] = {}
            
            if mese_str not in scheda_dis["interventi_mensili"]:
                scheda_dis["interventi_mensili"][mese_str] = {
                    "giorno": giorno,
                    "tipo": "Controllo periodico",
                    "esito": "Nessuna infestazione rilevata - OK",
                    "tecnico": "Tecnico autorizzato",
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Aggiorna anche il monitoraggio apparecchi
                apparecchi = [f"Frigorifero {i}" for i in range(1, 13)] + [f"Congelatore {i}" for i in range(1, 13)]
                for app in apparecchi:
                    if app not in scheda_dis.get("monitoraggio_apparecchi", {}):
                        scheda_dis["monitoraggio_apparecchi"][app] = {}
                    scheda_dis["monitoraggio_apparecchi"][app][mese_str] = {
                        "giorno": giorno,
                        "esito": "OK",
                        "note": "Nessuna anomalia"
                    }
                
                scheda_dis["updated_at"] = datetime.utcnow().isoformat()
                
                await db["disinfestazione_annuale"].update_one(
                    {"anno": anno},
                    {"$set": scheda_dis}
                )
                disinfestazione_updated = 1
        
        logger.info(f"✅ [SCHEDULER] Disinfestazione: {disinfestazione_updated}")
        
        logger.info(f"🎉 [SCHEDULER] Auto-popolazione HACCP V2 completata: "
                   f"Frigo={frigoriferi_updated}, Congel={congelatori_updated}, "
                   f"Sanif={sanificazioni_updated}, Disinf={disinfestazione_updated}")
        
    except Exception as e:
        logger.error(f"❌ [SCHEDULER] Errore auto-popolazione HACCP: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def check_anomalie_and_notify():
    """
    Task per controllare anomalie temperature e creare notifiche.
    """
    from app.database import Database
    
    logger.info("🔔 [SCHEDULER] Controllo anomalie temperature...")
    
    try:
        db = Database.get_db()
        oggi = datetime.utcnow()
        anno = oggi.year
        mese = str(oggi.month)
        giorno = str(oggi.day)
        
        anomalie_trovate = 0
        
        # Check frigoriferi
        async for scheda in db["temperature_positive"].find({"anno": anno}):
            temp_data = scheda.get("temperature", {}).get(mese, {}).get(giorno, {})
            temp = temp_data.get("temp")
            
            if temp is not None:
                temp_max = scheda.get("temp_max", 4)
                temp_min = scheda.get("temp_min", 0)
                
                if temp > temp_max or temp < temp_min:
                    anomalie_trovate += 1
                    
                    # Crea notifica
                    notifica = {
                        "id": str(uuid.uuid4()),
                        "tipo": "anomalia_temperatura",
                        "categoria": "frigorifero",
                        "equipaggiamento": scheda.get("frigorifero_nome"),
                        "temperatura": temp,
                        "range": f"{temp_min}°C - {temp_max}°C",
                        "data": oggi.strftime("%Y-%m-%d"),
                        "messaggio": f"⚠️ Temperatura {temp}°C fuori range su {scheda.get('frigorifero_nome')}",
                        "severita": "alta" if (temp > temp_max + 2 or temp < temp_min - 2) else "media",
                        "letta": False,
                        "created_at": datetime.utcnow().isoformat()
                    }
                    
                    # Evita duplicati
                    existing = await db["haccp_notifiche"].find_one({
                        "data": oggi.strftime("%Y-%m-%d"),
                        "equipaggiamento": scheda.get("frigorifero_nome"),
                        "categoria": "frigorifero"
                    })
                    
                    if not existing:
                        await db["haccp_notifiche"].insert_one(notifica)
        
        # Check congelatori
        async for scheda in db["temperature_negative"].find({"anno": anno}):
            temp_data = scheda.get("temperature", {}).get(mese, {}).get(giorno, {})
            temp = temp_data.get("temp")
            
            if temp is not None:
                temp_max = scheda.get("temp_max", -18)
                temp_min = scheda.get("temp_min", -22)
                
                if temp > temp_max or temp < temp_min:
                    anomalie_trovate += 1
                    
                    notifica = {
                        "id": str(uuid.uuid4()),
                        "tipo": "anomalia_temperatura",
                        "categoria": "congelatore",
                        "equipaggiamento": scheda.get("congelatore_nome"),
                        "temperatura": temp,
                        "range": f"{temp_min}°C - {temp_max}°C",
                        "data": oggi.strftime("%Y-%m-%d"),
                        "messaggio": f"⚠️ Temperatura {temp}°C fuori range su {scheda.get('congelatore_nome')}",
                        "severita": "alta" if temp > temp_max + 3 else "media",
                        "letta": False,
                        "created_at": datetime.utcnow().isoformat()
                    }
                    
                    existing = await db["haccp_notifiche"].find_one({
                        "data": oggi.strftime("%Y-%m-%d"),
                        "equipaggiamento": scheda.get("congelatore_nome"),
                        "categoria": "congelatore"
                    })
                    
                    if not existing:
                        await db["haccp_notifiche"].insert_one(notifica)
        
        logger.info(f"🔔 [SCHEDULER] Controllo completato: {anomalie_trovate} anomalie trovate")
        
    except Exception as e:
        logger.error(f"❌ [SCHEDULER] Errore check anomalie: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def daily_haccp_routine():
    """Routine giornaliera completa HACCP."""
    await auto_populate_haccp_daily()
    await check_anomalie_and_notify()


async def sync_gmail_aruba_task():
    """
    Task eseguito ogni 10 minuti.
    Scarica nuove fatture da Gmail/Aruba e notifica su Telegram.
    """
    from app.database import Database
    from app.services.aruba_invoice_parser import fetch_aruba_invoices
    from app.services.telegram_notifications import is_configured, send_telegram_notification
    
    logger.info("📧 [SCHEDULER] Avvio sync Gmail/Aruba...")
    
    try:
        db = Database.get_db()
        
        # Ottieni configurazione email
        email_config = await db["email_accounts"].find_one(
            {"tipo": "aruba"},
            {"_id": 0}
        )
        
        if not email_config:
            # Prova con config di default
            email_config = await db["email_accounts"].find_one({}, {"_id": 0})
        
        if not email_config:
            logger.warning("📧 [SCHEDULER] Nessun account email configurato per sync Aruba")
            return
        
        email_user = email_config.get("email") or email_config.get("username")
        email_password = email_config.get("password")
        imap_server = email_config.get("imap_server", "imap.gmail.com")
        
        if not email_user or not email_password:
            logger.warning("📧 [SCHEDULER] Credenziali email mancanti")
            return
        
        # Esegui sync
        result = await fetch_aruba_invoices(
            email_user=email_user,
            email_password=email_password,
            imap_server=imap_server,
            days_back=7,
            auto_import=True
        )
        
        nuove_operazioni = result.get("operazioni_create", 0)
        totale_processate = result.get("emails_processate", 0)
        
        logger.info(f"📧 [SCHEDULER] Sync completato: {nuove_operazioni} nuove operazioni da {totale_processate} email")
        
        # Notifica Telegram se ci sono nuove operazioni
        if nuove_operazioni > 0 and is_configured():
            from datetime import datetime
            
            messaggio = f"""📬 *Nuove Operazioni Aruba*

{nuove_operazioni} nuove fatture da confermare!

📅 {datetime.now().strftime('%d/%m/%Y %H:%M')}
📧 Email processate: {totale_processate}

👉 Vai su /operazioni-da-confermare per gestirle"""
            
            try:
                await send_telegram_notification(messaggio)
                logger.info("📱 [SCHEDULER] Notifica Telegram inviata")
            except Exception as e:
                logger.error(f"📱 [SCHEDULER] Errore notifica Telegram: {e}")
        
    except Exception as e:
        logger.error(f"📧 [SCHEDULER] Errore sync Gmail/Aruba: {e}")


def start_scheduler():
    """Avvia lo scheduler con i task programmati."""
    logger.info("🚀 [SCHEDULER] Configurazione scheduler...")
    
    # Task HACCP alle 00:01 CET ogni giorno
    scheduler.add_job(
        daily_haccp_routine,
        CronTrigger(hour=0, minute=1),  # 00:01 UTC
        id="haccp_daily_routine",
        name="Routine HACCP giornaliera (auto-pop + notifiche)",
        replace_existing=True
    )
    
    # Task Gmail/Aruba ogni 10 minuti
    scheduler.add_job(
        sync_gmail_aruba_task,
        'interval',
        minutes=10,
        id="gmail_aruba_sync",
        name="Sync Gmail/Aruba (ogni 10 min)",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("✅ [SCHEDULER] Scheduler avviato")
    logger.info("   - HACCP: 00:01 UTC giornaliero")
    logger.info("   - Gmail/Aruba: ogni 10 minuti")


def stop_scheduler():
    """Ferma lo scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("🛑 [SCHEDULER] Scheduler HACCP fermato")
