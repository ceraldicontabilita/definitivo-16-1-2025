"""
Email Notifications Router - Endpoint per invio notifiche email.
"""
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
from datetime import datetime, timezone
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from app.database import Database, Collections
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def get_smtp_config():
    """Get SMTP configuration from settings."""
    return {
        "host": getattr(settings, 'SMTP_HOST', os.environ.get('SMTP_HOST')),
        "port": int(getattr(settings, 'SMTP_PORT', os.environ.get('SMTP_PORT', 587))),
        "user": getattr(settings, 'SMTP_USERNAME', os.environ.get('SMTP_USER')),
        "password": getattr(settings, 'SMTP_PASSWORD', os.environ.get('SMTP_PASSWORD')),
        "from_email": getattr(settings, 'SMTP_FROM_EMAIL', os.environ.get('FROM_EMAIL'))
    }


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send HTML email via SMTP."""
    config = get_smtp_config()
    
    if not all([config["host"], config["user"], config["password"]]):
        logger.error("SMTP not configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = config["from_email"] or config["user"]
        msg['To'] = to_email
        
        html_part = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(html_part)
        
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            server.login(config["user"], config["password"])
            server.send_message(msg)
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        raise


@router.get("/status")
async def get_email_status() -> Dict[str, Any]:
    """Check email service status."""
    config = get_smtp_config()
    
    configured = all([config["host"], config["user"], config["password"]])
    
    return {
        "configured": configured,
        "smtp_host": config["host"],
        "from_email": config["from_email"] or config["user"],
        "status": "ready" if configured else "not_configured"
    }


@router.post("/test")
async def send_test_email(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Send test email."""
    to_email = data.get("to_email")
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email required")
    
    subject = "🧪 Test Email - ERP Azienda Semplice"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #4caf50;">✅ Test Email Riuscito!</h2>
        <p>Questa è un'email di test dal sistema ERP.</p>
        <p>Se ricevi questa email, la configurazione SMTP è corretta.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
            Inviata il: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}<br>
            ERP Azienda Semplice - Sistema di Gestione
        </p>
    </body>
    </html>
    """
    
    try:
        success = send_email(to_email, subject, html_body)
        return {"success": success, "message": f"Email inviata a {to_email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/f24-alerts")
async def send_f24_alerts_email(data: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Send F24 alerts email summary."""
    to_email = data.get("to_email")
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email required")
    
    db = Database.get_db()
    today = datetime.now(timezone.utc).date()
    
    # Get pending F24
    f24_list = await db[Collections.F24_MODELS].find({"status": {"$ne": "paid"}}, {"_id": 0}).to_list(1000)
    
    alerts = []
    for f24 in f24_list:
        try:
            scadenza_str = f24.get("scadenza") or f24.get("data_versamento")
            if not scadenza_str:
                continue
            
            if isinstance(scadenza_str, str):
                scadenza_str = scadenza_str.replace("Z", "+00:00")
                if "T" in scadenza_str:
                    scadenza = datetime.fromisoformat(scadenza_str).date()
                else:
                    try:
                        scadenza = datetime.strptime(scadenza_str, "%d/%m/%Y").date()
                    except ValueError:
                        scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
            else:
                continue
            
            giorni = (scadenza - today).days
            
            if giorni <= 7:  # Only alerts within 7 days
                if giorni < 0:
                    severity, color = "SCADUTO", "#d32f2f"
                elif giorni == 0:
                    severity, color = "OGGI", "#f57c00"
                elif giorni <= 3:
                    severity, color = "URGENTE", "#ff9800"
                else:
                    severity, color = "PROSSIMO", "#fbc02d"
                
                alerts.append({
                    "descrizione": f24.get("descrizione", "F24"),
                    "importo": float(f24.get("importo", 0) or 0),
                    "scadenza": scadenza.strftime("%d/%m/%Y"),
                    "giorni": giorni,
                    "severity": severity,
                    "color": color
                })
        except Exception as e:
            logger.error(f"Error processing F24: {e}")
    
    if not alerts:
        return {"success": True, "message": "Nessun alert F24 da inviare", "alerts_count": 0}
    
    # Sort by days
    alerts.sort(key=lambda x: x["giorni"])
    
    # Build email
    alerts_html = ""
    total_amount = 0
    for alert in alerts:
        total_amount += alert["importo"]
        alerts_html += f"""
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">
                <span style="background: {alert['color']}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                    {alert['severity']}
                </span>
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">{alert['descrizione']}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">€{alert['importo']:,.2f}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">{alert['scadenza']}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                {abs(alert['giorni'])} {'giorni fa' if alert['giorni'] < 0 else 'giorni'}
            </td>
        </tr>
        """
    
    subject = f"🚨 Alert Scadenze F24 - {len(alerts)} tributi in scadenza"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%); color: white; padding: 20px;">
                <h1 style="margin: 0;">🚨 Alert Scadenze F24</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Riepilogo tributi in scadenza</p>
            </div>
            
            <div style="padding: 20px;">
                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                    <div style="flex: 1; background: #ffebee; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #d32f2f;">{len(alerts)}</div>
                        <div style="font-size: 12px; color: #666;">Tributi in Scadenza</div>
                    </div>
                    <div style="flex: 1; background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #f57c00;">€{total_amount:,.2f}</div>
                        <div style="font-size: 12px; color: #666;">Totale da Pagare</div>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Stato</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Descrizione</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Importo</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Scadenza</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Giorni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {alerts_html}
                    </tbody>
                </table>
                
                <p style="margin-top: 20px; color: #666; font-size: 14px;">
                    ⚠️ <strong>Attenzione:</strong> Verifica le scadenze e procedi al pagamento per evitare sanzioni.
                </p>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                Email generata automaticamente da ERP Azienda Semplice<br>
                {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        success = send_email(to_email, subject, html_body)
        return {
            "success": success,
            "message": f"Email alert F24 inviata a {to_email}",
            "alerts_count": len(alerts),
            "total_amount": total_amount
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
