"""
Router per Chat AI
Endpoint per domande testuali e vocali sull'applicazione.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from typing import Dict, Any, Optional
import logging
import tempfile
import os

from app.services.chat_ai_service import get_chat_service, ChatAIService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ask")
async def ask_question(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Fa una domanda testuale alla Chat AI.
    
    Body:
    {
        "question": "Qual era l'ultima fattura di Naturissima?",
        "session_id": "optional-session-id",
        "anno": 2025  // Anno di riferimento (opzionale, default anno corrente)
    }
    """
    question = data.get("question", "").strip()
    session_id = data.get("session_id")
    anno = data.get("anno")  # Anno selezionato dall'utente
    
    if not question:
        raise HTTPException(status_code=400, detail="La domanda è richiesta")
    
    try:
        chat_service = get_chat_service(session_id)
        result = await chat_service.ask(question, anno=anno)
        return result
    except Exception as e:
        logger.exception(f"Errore chat AI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ask-voice")
async def ask_voice_question(
    audio: UploadFile = File(..., description="File audio (mp3, wav, m4a, webm)"),
    session_id: Optional[str] = Form(None)
) -> Dict[str, Any]:
    """
    Fa una domanda vocale alla Chat AI.
    
    1. Trascrive l'audio in testo con Whisper
    2. Elabora la domanda
    3. Restituisce la risposta
    """
    # Verifica formato audio
    allowed_formats = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a", "audio/webm", 
                       "audio/mp4", "audio/x-m4a", "audio/ogg", "video/webm"]
    
    if audio.content_type and audio.content_type not in allowed_formats:
        # Accetta comunque se l'estensione è corretta
        ext = audio.filename.split(".")[-1].lower() if audio.filename else ""
        if ext not in ["mp3", "wav", "m4a", "webm", "mp4", "ogg", "mpeg"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Formato audio non supportato: {audio.content_type}. Usa mp3, wav, m4a o webm."
            )
    
    try:
        chat_service = get_chat_service(session_id)
        
        # Salva temporaneamente il file audio
        suffix = f".{audio.filename.split('.')[-1]}" if audio.filename and '.' in audio.filename else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Trascrivi audio
            with open(tmp_path, "rb") as audio_file:
                transcription = await chat_service.transcribe_audio(audio_file, language="it")
            
            if not transcription or not transcription.strip():
                return {
                    "success": False,
                    "error": "Non sono riuscito a capire l'audio. Riprova parlando più chiaramente.",
                    "transcription": ""
                }
            
            # Elabora la domanda
            result = await chat_service.ask(transcription)
            result["transcription"] = transcription
            
            return result
            
        finally:
            # Elimina file temporaneo
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        logger.exception(f"Errore trascrizione/chat AI: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/history")
async def get_chat_history(session_id: str) -> Dict[str, Any]:
    """
    Ottiene la cronologia della chat per una sessione.
    Nota: La cronologia è gestita internamente dal servizio LlmChat.
    """
    # Per ora restituiamo solo info sessione
    # In futuro potremmo salvare la cronologia nel database
    return {
        "session_id": session_id,
        "message": "Cronologia chat disponibile nella sessione corrente"
    }


@router.delete("/session/{session_id}")
async def clear_session(session_id: str) -> Dict[str, Any]:
    """Elimina una sessione chat."""
    from app.services.chat_ai_service import _chat_sessions
    
    if session_id in _chat_sessions:
        del _chat_sessions[session_id]
        return {"success": True, "message": "Sessione eliminata"}
    
    return {"success": False, "message": "Sessione non trovata"}
