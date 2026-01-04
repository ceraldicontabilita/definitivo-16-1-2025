"""
Router per gestione invio documenti al Commercialista.

Permette l'invio via email di:
- Prima Nota Cassa mensile (PDF)
- Carnet assegni (PDF)
- Fatture pagate per cassa (PDF)
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from calendar import monthrange
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
import io
import base64

from app.database import Database, Collections

logger = logging.getLogger(__name__)
router = APIRouter()

# Email commercialista di default
DEFAULT_COMMERCIALISTA_EMAIL = "rosaria.marotta@email.it"


def get_smtp_config():
    """Get SMTP configuration from environment."""
    return {
        "host": os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        "port": int(os.environ.get('SMTP_PORT', 587)),
        "user": os.environ.get('SMTP_USER') or os.environ.get('SMTP_USERNAME'),
        "password": os.environ.get('SMTP_PASSWORD'),
        "from_email": os.environ.get('FROM_EMAIL') or os.environ.get('SMTP_FROM_EMAIL')
    }


def send_email_with_attachment(
    to_email: str, 
    subject: str, 
    html_body: str, 
    attachment_data: Optional[bytes] = None,
    attachment_name: Optional[str] = None
) -> bool:
    """Send email with optional PDF attachment."""
    config = get_smtp_config()
    
    if not all([config["host"], config["user"], config["password"]]):
        logger.error("SMTP not configured")
        raise HTTPException(status_code=500, detail="Configurazione SMTP mancante")
    
    try:
        msg = MIMEMultipart()
        msg['Subject'] = subject
        msg['From'] = config["from_email"] or config["user"]
        msg['To'] = to_email
        
        # HTML body
        html_part = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(html_part)
        
        # Attachment if provided
        if attachment_data and attachment_name:
            part = MIMEBase('application', 'pdf')
            part.set_payload(attachment_data)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{attachment_name}"')
            msg.attach(part)
        
        with smtplib.SMTP(config["host"], config["port"], timeout=30) as server:
            server.starttls()
            server.login(config["user"], config["password"])
            server.send_message(msg)
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        raise HTTPException(status_code=500, detail=f"Errore invio email: {str(e)}")


@router.get("/config")
async def get_commercialista_config() -> Dict[str, Any]:
    """Get commercialista configuration."""
    db = Database.get_db()
    
    # Try to get config from DB
    config = await db["commercialista_config"].find_one({}, {"_id": 0})
    
    if not config:
        config = {
            "email": DEFAULT_COMMERCIALISTA_EMAIL,
            "nome": "Dott.ssa Rosaria Marotta",
            "alert_giorni": 2,
            "invio_automatico": False
        }
    
    # Add SMTP status
    smtp_config = get_smtp_config()
    config["smtp_configured"] = all([smtp_config["host"], smtp_config["user"], smtp_config["password"]])
    
    return config


@router.put("/config")
async def update_commercialista_config(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Update commercialista configuration."""
    db = Database.get_db()
    
    update_data = {
        "email": data.get("email", DEFAULT_COMMERCIALISTA_EMAIL),
        "nome": data.get("nome", ""),
        "alert_giorni": data.get("alert_giorni", 2),
        "invio_automatico": data.get("invio_automatico", False),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["commercialista_config"].update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "config": update_data}


@router.get("/prima-nota-cassa/{anno}/{mese}")
async def get_prima_nota_cassa_mensile(anno: int, mese: int) -> Dict[str, Any]:
    """Get Prima Nota Cassa for a specific month."""
    db = Database.get_db()
    
    # Date range for the month
    start_date = datetime(anno, mese, 1, 0, 0, 0, tzinfo=timezone.utc)
    _, last_day = monthrange(anno, mese)
    end_date = datetime(anno, mese, last_day, 23, 59, 59, tzinfo=timezone.utc)
    
    # Query prima nota cassa movements
    movements = []
    
    # Try prima_nota collection first
    cursor = db["prima_nota"].find({
        "tipo_conto": "cassa",
        "$or": [
            {"data": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}},
            {"date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
        ]
    }, {"_id": 0})
    movements = await cursor.to_list(5000)
    
    # If empty, try cash collection
    if not movements:
        cursor = db["cash"].find({
            "$or": [
                {"data": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}},
                {"date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
            ]
        }, {"_id": 0})
        movements = await cursor.to_list(5000)
    
    # Calculate totals
    totale_entrate = 0
    totale_uscite = 0
    
    for m in movements:
        tipo = m.get("type") or m.get("tipo") or ""
        importo = float(m.get("amount") or m.get("importo") or 0)
        
        if tipo.lower() in ["entrata", "income", "in"]:
            totale_entrate += importo
        else:
            totale_uscite += importo
    
    saldo = totale_entrate - totale_uscite
    
    return {
        "anno": anno,
        "mese": mese,
        "mese_nome": ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                     "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"][mese],
        "movimenti": movements,
        "totale_movimenti": len(movements),
        "totale_entrate": totale_entrate,
        "totale_uscite": totale_uscite,
        "saldo": saldo
    }


@router.get("/fatture-cassa/{anno}/{mese}")
async def get_fatture_pagate_cassa(anno: int, mese: int) -> Dict[str, Any]:
    """Get invoices paid by cash for a specific month."""
    db = Database.get_db()
    
    start_date = datetime(anno, mese, 1, 0, 0, 0, tzinfo=timezone.utc)
    _, last_day = monthrange(anno, mese)
    end_date = datetime(anno, mese, last_day, 23, 59, 59, tzinfo=timezone.utc)
    
    # Query fatture with payment method = contanti/cassa
    fatture = []
    
    # Look for invoices paid by cash
    cursor = db["invoices"].find({
        "$or": [
            {"metodo_pagamento": {"$regex": "contant|cassa", "$options": "i"}},
            {"payment_method": {"$regex": "contant|cassa|cash", "$options": "i"}},
            {"modalita_pagamento": {"$regex": "contant|cassa", "$options": "i"}}
        ]
    }, {"_id": 0})
    
    all_fatture = await cursor.to_list(10000)
    
    # Filter by date
    for f in all_fatture:
        data_str = f.get("invoice_date") or f.get("data_fattura") or f.get("data_pagamento") or ""
        if data_str:
            try:
                if "T" in str(data_str):
                    data = datetime.fromisoformat(str(data_str).replace("Z", "+00:00"))
                else:
                    data = datetime.strptime(str(data_str)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                
                if start_date <= data <= end_date:
                    fatture.append(f)
            except:
                pass
    
    totale = sum(float(f.get("total_amount") or f.get("importo_totale") or 0) for f in fatture)
    
    return {
        "anno": anno,
        "mese": mese,
        "mese_nome": ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                     "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"][mese],
        "fatture": fatture,
        "totale_fatture": len(fatture),
        "totale_importo": totale
    }


@router.post("/invia-prima-nota")
async def invia_prima_nota_cassa(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Send Prima Nota Cassa via email with PDF attachment."""
    anno = data.get("anno")
    mese = data.get("mese")
    email = data.get("email", DEFAULT_COMMERCIALISTA_EMAIL)
    pdf_base64 = data.get("pdf_base64")  # PDF generated by frontend
    
    if not anno or not mese:
        raise HTTPException(status_code=400, detail="Anno e mese richiesti")
    
    mese_nome = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                 "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"][mese]
    
    # Get data for email body
    prima_nota_data = await get_prima_nota_cassa_mensile(anno, mese)
    
    subject = f"📒 Prima Nota Cassa - {mese_nome} {anno}"
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 20px;">
                <h1 style="margin: 0;">📒 Prima Nota Cassa</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">{mese_nome} {anno}</p>
            </div>
            
            <div style="padding: 20px;">
                <p>Gentile Commercialista,</p>
                <p>in allegato trova la Prima Nota Cassa relativa al mese di <strong>{mese_nome} {anno}</strong>.</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1e3a5f;">📊 Riepilogo</h3>
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 5px 0;">Movimenti totali:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold;">{prima_nota_data['totale_movimenti']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #4caf50;">Totale Entrate:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold; color: #4caf50;">€ {prima_nota_data['totale_entrate']:,.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #f44336;">Totale Uscite:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold; color: #f44336;">€ {prima_nota_data['totale_uscite']:,.2f}</td>
                        </tr>
                        <tr style="border-top: 2px solid #ddd;">
                            <td style="padding: 10px 0 5px 0; font-weight: bold;">Saldo:</td>
                            <td style="padding: 10px 0 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: {'#4caf50' if prima_nota_data['saldo'] >= 0 else '#f44336'};">€ {prima_nota_data['saldo']:,.2f}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    Il documento PDF allegato contiene il dettaglio completo di tutti i movimenti.
                </p>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                Ceraldi Group S.R.L. - ERP Azienda Semplice<br>
                Email generata automaticamente il {datetime.now().strftime('%d/%m/%Y alle %H:%M')}
            </div>
        </div>
    </body>
    </html>
    """
    
    # Decode PDF if provided
    pdf_bytes = None
    if pdf_base64:
        try:
            pdf_bytes = base64.b64decode(pdf_base64)
        except Exception as e:
            logger.error(f"Error decoding PDF: {e}")
    
    filename = f"Prima_Nota_Cassa_{mese_nome}_{anno}.pdf"
    
    success = send_email_with_attachment(email, subject, html_body, pdf_bytes, filename)
    
    # Log the send
    db = Database.get_db()
    await db["commercialista_log"].insert_one({
        "tipo": "prima_nota_cassa",
        "anno": anno,
        "mese": mese,
        "email": email,
        "data_invio": datetime.now(timezone.utc).isoformat(),
        "success": success
    })
    
    return {
        "success": success,
        "message": f"Prima Nota Cassa {mese_nome} {anno} inviata a {email}"
    }


@router.post("/invia-carnet")
async def invia_carnet(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Send Carnet assegni via email with PDF attachment."""
    carnet_id = data.get("carnet_id")
    email = data.get("email", DEFAULT_COMMERCIALISTA_EMAIL)
    pdf_base64 = data.get("pdf_base64")
    assegni_count = data.get("assegni_count", 0)
    totale_importo = data.get("totale_importo", 0)
    
    if not carnet_id:
        raise HTTPException(status_code=400, detail="carnet_id richiesto")
    
    subject = f"📝 Carnet Assegni - {carnet_id}"
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 20px;">
                <h1 style="margin: 0;">📝 Carnet Assegni</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">ID: {carnet_id}</p>
            </div>
            
            <div style="padding: 20px;">
                <p>Gentile Commercialista,</p>
                <p>in allegato trova il riepilogo del carnet assegni <strong>{carnet_id}</strong>.</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #2e7d32;">📊 Riepilogo Carnet</h3>
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 5px 0;">Numero Assegni:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold;">{assegni_count}</td>
                        </tr>
                        <tr style="border-top: 1px solid #ddd;">
                            <td style="padding: 10px 0 5px 0; font-weight: bold;">Totale Importo:</td>
                            <td style="padding: 10px 0 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: #2e7d32;">€ {totale_importo:,.2f}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    Il documento PDF allegato contiene il dettaglio di tutti gli assegni del carnet.
                </p>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                Ceraldi Group S.R.L. - ERP Azienda Semplice<br>
                Email generata automaticamente il {datetime.now().strftime('%d/%m/%Y alle %H:%M')}
            </div>
        </div>
    </body>
    </html>
    """
    
    pdf_bytes = None
    if pdf_base64:
        try:
            pdf_bytes = base64.b64decode(pdf_base64)
        except Exception as e:
            logger.error(f"Error decoding PDF: {e}")
    
    filename = f"Carnet_Assegni_{carnet_id}.pdf"
    
    success = send_email_with_attachment(email, subject, html_body, pdf_bytes, filename)
    
    # Log the send
    db = Database.get_db()
    await db["commercialista_log"].insert_one({
        "tipo": "carnet_assegni",
        "carnet_id": carnet_id,
        "email": email,
        "data_invio": datetime.now(timezone.utc).isoformat(),
        "success": success
    })
    
    return {
        "success": success,
        "message": f"Carnet {carnet_id} inviato a {email}"
    }


@router.post("/invia-fatture-cassa")
async def invia_fatture_cassa(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Send fatture pagate per cassa via email with PDF attachment."""
    anno = data.get("anno")
    mese = data.get("mese")
    email = data.get("email", DEFAULT_COMMERCIALISTA_EMAIL)
    pdf_base64 = data.get("pdf_base64")
    
    if not anno or not mese:
        raise HTTPException(status_code=400, detail="Anno e mese richiesti")
    
    mese_nome = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                 "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"][mese]
    
    # Get data for email body
    fatture_data = await get_fatture_pagate_cassa(anno, mese)
    
    subject = f"💵 Fatture Pagate in Contanti - {mese_nome} {anno}"
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 20px;">
                <h1 style="margin: 0;">💵 Fatture Pagate in Contanti</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">{mese_nome} {anno}</p>
            </div>
            
            <div style="padding: 20px;">
                <p>Gentile Commercialista,</p>
                <p>in allegato trova l'elenco delle fatture pagate in contanti nel mese di <strong>{mese_nome} {anno}</strong>.</p>
                
                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #f57c00;">📊 Riepilogo</h3>
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 5px 0;">Numero Fatture:</td>
                            <td style="padding: 5px 0; text-align: right; font-weight: bold;">{fatture_data['totale_fatture']}</td>
                        </tr>
                        <tr style="border-top: 1px solid #ffe0b2;">
                            <td style="padding: 10px 0 5px 0; font-weight: bold;">Totale:</td>
                            <td style="padding: 10px 0 5px 0; text-align: right; font-weight: bold; font-size: 18px; color: #f57c00;">€ {fatture_data['totale_importo']:,.2f}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    Il documento PDF allegato contiene il dettaglio di tutte le fatture.
                </p>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                Ceraldi Group S.R.L. - ERP Azienda Semplice<br>
                Email generata automaticamente il {datetime.now().strftime('%d/%m/%Y alle %H:%M')}
            </div>
        </div>
    </body>
    </html>
    """
    
    pdf_bytes = None
    if pdf_base64:
        try:
            pdf_bytes = base64.b64decode(pdf_base64)
        except Exception as e:
            logger.error(f"Error decoding PDF: {e}")
    
    filename = f"Fatture_Contanti_{mese_nome}_{anno}.pdf"
    
    success = send_email_with_attachment(email, subject, html_body, pdf_bytes, filename)
    
    # Log the send
    db = Database.get_db()
    await db["commercialista_log"].insert_one({
        "tipo": "fatture_cassa",
        "anno": anno,
        "mese": mese,
        "email": email,
        "data_invio": datetime.now(timezone.utc).isoformat(),
        "success": success
    })
    
    return {
        "success": success,
        "message": f"Fatture contanti {mese_nome} {anno} inviate a {email}"
    }


@router.get("/log")
async def get_invio_log(limit: int = 50) -> Dict[str, Any]:
    """Get log of sent documents."""
    db = Database.get_db()
    
    cursor = db["commercialista_log"].find({}, {"_id": 0}).sort("data_invio", -1).limit(limit)
    log_entries = await cursor.to_list(limit)
    
    return {
        "log": log_entries,
        "totale": len(log_entries)
    }


@router.get("/alert-status")
async def get_alert_status() -> Dict[str, Any]:
    """Check if there are pending documents to send (for alert)."""
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year
    
    # Previous month
    if current_month == 1:
        prev_month = 12
        prev_year = current_year - 1
    else:
        prev_month = current_month - 1
        prev_year = current_year
    
    # Check if we're within 2 days of the month end
    _, last_day = monthrange(prev_year, prev_month)
    deadline = datetime(current_year, current_month, 2, 23, 59, 59, tzinfo=timezone.utc)
    
    db = Database.get_db()
    
    # Check if prima nota was already sent for previous month
    prima_nota_sent = await db["commercialista_log"].find_one({
        "tipo": "prima_nota_cassa",
        "anno": prev_year,
        "mese": prev_month,
        "success": True
    })
    
    show_alert = now <= deadline and not prima_nota_sent
    
    mese_nome = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                 "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"][prev_month]
    
    return {
        "show_alert": show_alert,
        "mese_pendente": prev_month,
        "anno_pendente": prev_year,
        "mese_nome": mese_nome,
        "deadline": deadline.isoformat(),
        "prima_nota_inviata": prima_nota_sent is not None,
        "message": f"Ricordati di inviare la Prima Nota Cassa di {mese_nome} {prev_year} al commercialista!" if show_alert else None
    }
