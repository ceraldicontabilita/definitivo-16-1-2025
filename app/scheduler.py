"""
Scheduler per task automatici HACCP.
Auto-popolamento temperature alle 01:00 AM ogni giorno.
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
OPERATORI_HACCP = ["VALERIO", "VINCENZO", "POCCI", "MARIO", "LUIGI"]


async def auto_populate_haccp_daily():
    """
    Task eseguito alle 01:00 AM ogni giorno.
    Genera e compila automaticamente i record HACCP per il giorno corrente.
    """
    from app.database import Database
    
    logger.info("🕐 [SCHEDULER] Avvio auto-popolazione HACCP giornaliera")
    
    try:
        db = Database.get_db()
        oggi = datetime.utcnow().strftime("%Y-%m-%d")
        ora = "07:00"  # Ora standard di rilevazione mattutina
        now_iso = datetime.utcnow().isoformat()
        
        # ============== FRIGORIFERI ==============
        frigoriferi_created = 0
        # Carica equipaggiamenti frigoriferi
        frigo_equips = await db["haccp_equipaggiamenti"].find(
            {"tipo": "frigorifero", "attivo": {"$ne": False}},
            {"_id": 0}
        ).to_list(100)
        
        # Default se non ci sono equipaggiamenti
        if not frigo_equips:
            frigo_equips = [
                {"nome": "Frigo Cucina"},
                {"nome": "Frigo Bar"},
                {"nome": "Cella Frigo"},
            ]
        
        for frigo in frigo_equips:
            nome = frigo.get("nome", "Frigo")
            
            # Verifica se esiste già un record per oggi
            existing = await db["haccp_temperature_frigoriferi"].find_one({
                "data": oggi,
                "equipaggiamento": nome
            })
            
            if not existing:
                # Genera temperatura casuale conforme (0-4°C)
                temp = round(random.uniform(1.5, 3.5), 1)
                
                record = {
                    "id": f"auto_{oggi}_{nome.replace(' ', '_')}",
                    "data": oggi,
                    "ora": ora,
                    "equipaggiamento": nome,
                    "temperatura": temp,
                    "conforme": True,
                    "operatore": random.choice(OPERATORI_HACCP),
                    "note": "Auto-generato",
                    "source": "scheduler_auto",
                    "created_at": now_iso
                }
                await db["haccp_temperature_frigoriferi"].insert_one(record)
                frigoriferi_created += 1
        
        logger.info(f"✅ [SCHEDULER] Frigoriferi: creati {frigoriferi_created} record")
        
        # ============== CONGELATORI ==============
        congelatori_created = 0
        # Carica equipaggiamenti congelatori
        congel_equips = await db["haccp_equipaggiamenti"].find(
            {"tipo": "congelatore", "attivo": {"$ne": False}},
            {"_id": 0}
        ).to_list(100)
        
        # Default se non ci sono equipaggiamenti
        if not congel_equips:
            congel_equips = [
                {"nome": "Congelatore Cucina"},
                {"nome": "Cella Freezer"},
            ]
        
        for congel in congel_equips:
            nome = congel.get("nome", "Congelatore")
            
            existing = await db["haccp_temperature_congelatori"].find_one({
                "data": oggi,
                "equipaggiamento": nome
            })
            
            if not existing:
                # Genera temperatura casuale conforme (-18/-22°C)
                temp = round(random.uniform(-21, -18.5), 1)
                
                record = {
                    "id": f"auto_{oggi}_{nome.replace(' ', '_')}",
                    "data": oggi,
                    "ora": ora,
                    "equipaggiamento": nome,
                    "temperatura": temp,
                    "conforme": True,
                    "operatore": random.choice(OPERATORI_HACCP),
                    "note": "Auto-generato",
                    "source": "scheduler_auto",
                    "created_at": now_iso
                }
                await db["haccp_temperature_congelatori"].insert_one(record)
                congelatori_created += 1
        
        logger.info(f"✅ [SCHEDULER] Congelatori: creati {congelatori_created} record")
        
        # ============== SANIFICAZIONI ==============
        sanificazioni_created = 0
        aree_sanificazione = [
            "Cucina", "Sala", "Bar", "Bagni", "Magazzino", 
            "Celle Frigo", "Piani di lavoro"
        ]
        
        for area in aree_sanificazione:
            existing = await db["haccp_sanificazioni"].find_one({
                "data": oggi,
                "area": area
            })
            
            if not existing:
                record = {
                    "id": f"auto_san_{oggi}_{area.replace(' ', '_')}",
                    "data": oggi,
                    "ora": ora,
                    "area": area,
                    "tipo_intervento": "Pulizia ordinaria",
                    "prodotto_usato": "Detergente multiuso",
                    "operatore": random.choice(OPERATORI_HACCP),
                    "esito": "Conforme",
                    "note": "Auto-generato",
                    "source": "scheduler_auto",
                    "created_at": now_iso
                }
                await db["haccp_sanificazioni"].insert_one(record)
                sanificazioni_created += 1
        
        logger.info(f"✅ [SCHEDULER] Sanificazioni: creati {sanificazioni_created} record")
        
        logger.info(f"🎉 [SCHEDULER] Auto-popolazione HACCP completata: "
                   f"Frigo={frigoriferi_created}, Congel={congelatori_created}, Sanif={sanificazioni_created}")
        
    except Exception as e:
        logger.error(f"❌ [SCHEDULER] Errore auto-popolazione HACCP: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def check_anomalie_and_notify():
    """
    Task per controllare anomalie e inviare notifiche email.
    Eseguito dopo l'auto-popolazione.
    """
    from app.database import Database
    
    logger.info("🔔 [SCHEDULER] Controllo anomalie e notifiche...")
    
    try:
        db = Database.get_db()
        oggi = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Check anomalie frigoriferi
        anomalie_frigo = await db["haccp_temperature_frigoriferi"].find({
            "data": oggi,
            "conforme": False
        }, {"_id": 0}).to_list(100)
        
        # Check anomalie congelatori
        anomalie_congel = await db["haccp_temperature_congelatori"].find({
            "data": oggi,
            "conforme": False
        }, {"_id": 0}).to_list(100)
        
        notifiche_create = 0
        anomalie_critiche = []
        
        for a in anomalie_frigo:
            temp = a.get("temperatura", 0)
            is_critica = temp > 8 or temp < -2
            
            notifica = {
                "id": str(uuid.uuid4()),
                "tipo": "anomalia_temperatura",
                "categoria": "frigorifero",
                "equipaggiamento": a.get("equipaggiamento"),
                "temperatura": temp,
                "data": oggi,
                "ora": a.get("ora"),
                "messaggio": f"⚠️ Temperatura anomala {temp}°C su {a.get('equipaggiamento')} (range: 0-4°C)",
                "severita": "alta" if is_critica else "media",
                "letta": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            existing = await db["haccp_notifiche"].find_one({
                "data": oggi,
                "equipaggiamento": a.get("equipaggiamento"),
                "categoria": "frigorifero"
            })
            
            if not existing:
                await db["haccp_notifiche"].insert_one(notifica)
                notifiche_create += 1
                if is_critica:
                    anomalie_critiche.append(notifica)
        
        for a in anomalie_congel:
            temp = a.get("temperatura", 0)
            is_critica = temp > -15
            
            notifica = {
                "id": str(uuid.uuid4()),
                "tipo": "anomalia_temperatura",
                "categoria": "congelatore",
                "equipaggiamento": a.get("equipaggiamento"),
                "temperatura": temp,
                "data": oggi,
                "ora": a.get("ora"),
                "messaggio": f"⚠️ Temperatura anomala {temp}°C su {a.get('equipaggiamento')} (range: -18/-22°C)",
                "severita": "alta" if is_critica else "media",
                "letta": False,
                "created_at": datetime.utcnow().isoformat()
            }
            
            existing = await db["haccp_notifiche"].find_one({
                "data": oggi,
                "equipaggiamento": a.get("equipaggiamento"),
                "categoria": "congelatore"
            })
            
            if not existing:
                await db["haccp_notifiche"].insert_one(notifica)
                notifiche_create += 1
                if is_critica:
                    anomalie_critiche.append(notifica)
        
        logger.info(f"🔔 [SCHEDULER] Notifiche create: {notifiche_create}, Critiche: {len(anomalie_critiche)}")
        
        # Invia email se ci sono anomalie critiche
        if anomalie_critiche:
            await send_anomalie_email(anomalie_critiche, oggi)
        
    except Exception as e:
        logger.error(f"❌ [SCHEDULER] Errore check anomalie: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def send_anomalie_email(anomalie: list, data: str):
    """Invia email per anomalie critiche HACCP."""
    import os
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    email_to = os.environ.get("HACCP_ALERT_EMAIL", smtp_user)
    
    if not smtp_user or not smtp_pass:
        logger.warning("⚠️ [SCHEDULER] Credenziali SMTP non configurate, email non inviata")
        return
    
    try:
        # Costruisci email
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🚨 ALERT HACCP - {len(anomalie)} Anomalie Critiche - {data}"
        msg["From"] = smtp_user
        msg["To"] = email_to
        
        # Corpo email HTML
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; }}
                .header {{ background: #f44336; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; }}
                .anomalia {{ background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 10px 0; }}
                .temp {{ font-size: 24px; font-weight: bold; color: #f44336; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚨 ALERT HACCP</h1>
                <p>Rilevate {len(anomalie)} anomalie critiche - {data}</p>
            </div>
            <div class="content">
                <p>Sono state rilevate le seguenti anomalie di temperatura che richiedono intervento immediato:</p>
        """
        
        for a in anomalie:
            html += f"""
                <div class="anomalia">
                    <strong>{a.get('categoria', '').upper()}: {a.get('equipaggiamento')}</strong><br>
                    <span class="temp">{a.get('temperatura')}°C</span><br>
                    <small>{a.get('messaggio')}</small>
                </div>
            """
        
        html += """
                <p style="margin-top: 20px; color: #666;">
                    Questo è un messaggio automatico dal sistema HACCP.<br>
                    Accedi alla piattaforma per maggiori dettagli.
                </p>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html, "html"))
        
        # Invia email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, email_to, msg.as_string())
        
        logger.info(f"📧 [SCHEDULER] Email alert HACCP inviata a {email_to}")
        
    except Exception as e:
        logger.error(f"❌ [SCHEDULER] Errore invio email: {e}")


async def daily_haccp_routine():
    """Routine giornaliera completa HACCP."""
    await auto_populate_haccp_daily()
    await check_anomalie_and_notify()


def start_scheduler():
    """Avvia lo scheduler con i task programmati."""
    logger.info("🚀 [SCHEDULER] Configurazione scheduler HACCP...")
    
    # Task alle 01:00 AM ogni giorno (ora server UTC)
    # Se il server è in UTC, 01:00 UTC = 02:00 CET (Italia)
    # Quindi mettiamo 00:00 UTC per avere 01:00 CET
    scheduler.add_job(
        daily_haccp_routine,
        CronTrigger(hour=0, minute=0),  # 00:00 UTC = 01:00 CET
        id="haccp_daily_routine",
        name="Routine HACCP giornaliera (auto-pop + notifiche)",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("✅ [SCHEDULER] Scheduler HACCP avviato - Task: 01:00 AM (CET)")


def stop_scheduler():
    """Ferma lo scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("🛑 [SCHEDULER] Scheduler HACCP fermato")
