"""
Servizio Email per notifiche automatiche.
Supporta Gmail SMTP con retry e exponential backoff.
"""
import os
import time
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional, Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class EmailService:
    """
    Servizio per invio email automatiche.
    
    Configurazione via environment variables:
    - SMTP_HOST: Server SMTP (default: smtp.gmail.com)
    - SMTP_PORT: Porta SMTP (default: 587)
    - SMTP_EMAIL: Email mittente
    - SMTP_PASSWORD: Password/App password
    """
    
    def __init__(
        self,
        smtp_host: str = None,
        smtp_port: int = None,
        smtp_email: str = None,
        smtp_password: str = None,
        max_retries: int = 3,
        retry_delay: float = 2.0
    ):
        self.smtp_host = smtp_host or os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = smtp_port or int(os.environ.get('SMTP_PORT', 587))
        self.smtp_email = smtp_email or os.environ.get('SMTP_EMAIL', '')
        self.smtp_password = smtp_password or os.environ.get('SMTP_PASSWORD', '')
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        if not self.smtp_password:
            logger.warning("SMTP_PASSWORD non configurato - servizio email disabilitato")
    
    @contextmanager
    def smtp_connection(self) -> Iterator[smtplib.SMTP]:
        """
        Context manager per connessione SMTP sicura.
        
        Yields:
            Connessione SMTP autenticata
        """
        server = None
        try:
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.smtp_email, self.smtp_password)
            yield server
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass
    
    def send_email_with_retry(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        from_name: str = "ERP Sistema"
    ) -> Dict[str, Any]:
        """
        Invia email con retry e exponential backoff.
        
        Args:
            to_email: Destinatario
            subject: Oggetto
            body_html: Corpo HTML
            from_name: Nome mittente
            
        Returns:
            {"success": bool, "message": str}
        """
        if not self.smtp_password:
            return {"success": False, "message": "Servizio email non configurato"}
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{from_name} <{self.smtp_email}>"
        msg['To'] = to_email
        
        html_part = MIMEText(body_html, 'html')
        msg.attach(html_part)
        
        last_error = None
        for attempt in range(self.max_retries):
            try:
                with self.smtp_connection() as server:
                    server.sendmail(self.smtp_email, to_email, msg.as_string())
                    logger.info(f"Email inviata a {to_email}: {subject}")
                    return {"success": True, "message": "Email inviata con successo"}
                    
            except smtplib.SMTPException as e:
                last_error = str(e)
                logger.warning(f"Tentativo {attempt + 1}/{self.max_retries} fallito: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (2 ** attempt))
                    
            except Exception as e:
                last_error = str(e)
                logger.error(f"Errore invio email: {e}")
                break
        
        return {"success": False, "message": f"Invio fallito: {last_error}"}
    
    def send_libretto_alert_email(
        self,
        employee_name: str,
        employee_email: str,
        expiry_date: str,
        days_remaining: int
    ) -> Dict[str, Any]:
        """
        Invia alert scadenza libretto sanitario.
        
        Args:
            employee_name: Nome dipendente
            employee_email: Email dipendente
            expiry_date: Data scadenza
            days_remaining: Giorni rimanenti
        """
        subject = f"⚠️ Scadenza Libretto Sanitario - {employee_name}"
        
        if days_remaining <= 0:
            urgency = "🔴 SCADUTO"
            urgency_color = "#dc3545"
        elif days_remaining <= 7:
            urgency = "🟠 URGENTE"
            urgency_color = "#fd7e14"
        else:
            urgency = "🟡 ATTENZIONE"
            urgency_color = "#ffc107"
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {urgency_color}; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">{urgency}</h1>
                <p style="margin: 10px 0 0 0;">Scadenza Libretto Sanitario</p>
            </div>
            
            <div style="padding: 20px; background: #f8f9fa;">
                <p>Gentile <strong>{employee_name}</strong>,</p>
                
                <p>Il tuo libretto sanitario risulta:
                <strong style="color: {urgency_color};">
                    {"SCADUTO" if days_remaining <= 0 else f"in scadenza tra {days_remaining} giorni"}
                </strong>
                </p>
                
                <div style="background: white; padding: 15px; border-left: 4px solid {urgency_color}; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Data scadenza:</strong> {expiry_date}</p>
                </div>
                
                <p>Ti preghiamo di provvedere al rinnovo presso l'ASL competente il prima possibile.</p>
                
                <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                
                <p style="font-size: 12px; color: #6c757d;">
                    Questa è una notifica automatica dal sistema ERP.<br>
                    Non rispondere a questa email.
                </p>
            </div>
        </body>
        </html>
        """
        
        return self.send_email_with_retry(employee_email, subject, body_html)
    
    async def check_and_send_alerts(
        self, 
        db,
        alert_threshold_days: int = 30,
        admin_email: str = None
    ) -> Dict[str, Any]:
        """
        Controlla scadenze e invia alert automatici.
        
        Args:
            db: Database connection
            alert_threshold_days: Giorni prima della scadenza per alert
            admin_email: Email admin per riepilogo
            
        Returns:
            Statistiche invio
        """
        results = {
            "checked": 0,
            "alerts_sent": 0,
            "errors": 0,
            "details": []
        }
        
        today = datetime.now(timezone.utc).date()
        threshold_date = today + timedelta(days=alert_threshold_days)
        
        try:
            # Cerca dipendenti con libretto in scadenza
            employees = await db["employees"].find(
                {"libretto_sanitario_scadenza": {"$exists": True}},
                {"_id": 0}
            ).to_list(1000)
            
            for emp in employees:
                results["checked"] += 1
                
                scadenza_str = emp.get("libretto_sanitario_scadenza")
                if not scadenza_str:
                    continue
                
                try:
                    if isinstance(scadenza_str, str):
                        scadenza = datetime.strptime(scadenza_str, "%Y-%m-%d").date()
                    else:
                        scadenza = scadenza_str.date() if hasattr(scadenza_str, 'date') else scadenza_str
                    
                    days_until_expiry = (scadenza - today).days
                    
                    if days_until_expiry <= alert_threshold_days:
                        email = emp.get("email")
                        if email:
                            result = self.send_libretto_alert_email(
                                employee_name=emp.get("nome_completo", emp.get("name", "Dipendente")),
                                employee_email=email,
                                expiry_date=scadenza.strftime("%d/%m/%Y"),
                                days_remaining=days_until_expiry
                            )
                            
                            if result.get("success"):
                                results["alerts_sent"] += 1
                            else:
                                results["errors"] += 1
                                
                            results["details"].append({
                                "employee": emp.get("nome_completo"),
                                "expiry": scadenza.isoformat(),
                                "days": days_until_expiry,
                                "sent": result.get("success")
                            })
                            
                except Exception as e:
                    logger.error(f"Errore processing employee {emp.get('id')}: {e}")
                    results["errors"] += 1
            
            # Invia riepilogo admin
            if admin_email and results["alerts_sent"] > 0:
                self._send_admin_summary(admin_email, results)
                
        except Exception as e:
            logger.error(f"Errore check_and_send_alerts: {e}")
            
        return results
    
    def _send_admin_summary(self, admin_email: str, results: Dict) -> None:
        """Invia riepilogo giornaliero all'admin."""
        subject = f"📊 Riepilogo Alert Scadenze - {datetime.now().strftime('%d/%m/%Y')}"
        
        details_html = ""
        for d in results.get("details", [])[:20]:
            status = "✅" if d.get("sent") else "❌"
            details_html += f"<tr><td>{d.get('employee')}</td><td>{d.get('expiry')}</td><td>{d.get('days')} giorni</td><td>{status}</td></tr>"
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Riepilogo Alert Scadenze</h2>
            <ul>
                <li>Dipendenti controllati: {results.get('checked')}</li>
                <li>Alert inviati: {results.get('alerts_sent')}</li>
                <li>Errori: {results.get('errors')}</li>
            </ul>
            
            <h3>Dettagli</h3>
            <table border="1" cellpadding="5" cellspacing="0">
                <tr><th>Dipendente</th><th>Scadenza</th><th>Giorni</th><th>Stato</th></tr>
                {details_html}
            </table>
        </body>
        </html>
        """
        
        self.send_email_with_retry(admin_email, subject, body_html)


# Singleton instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Restituisce istanza singleton del servizio email."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
