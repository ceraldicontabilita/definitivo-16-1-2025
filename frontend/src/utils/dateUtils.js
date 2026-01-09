/**
 * Formatta una data nel formato italiano DD/MM/YYYY
 * @param {string} dataStr - Data in qualsiasi formato
 * @returns {string} Data formattata
 */
export const formattaDataItaliana = (dataStr) => {
  if (!dataStr) return "";
  
  // Già in formato italiano DD/MM/YYYY
  if (dataStr.includes("/") && dataStr.split("/")[0].length <= 2) {
    return dataStr;
  }
  
  // Formato ISO o datetime
  try {
    const dt = new Date(dataStr);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('it-IT');
    }
  } catch (e) { /* ignora errori di parsing */ }
  
  return dataStr;
};

/**
 * Calcola i giorni in un mese
 * @param {number} mese - Numero del mese (1-12)
 * @param {number} anno - Anno
 * @returns {number} Numero di giorni
 */
export const giorniNelMese = (mese, anno) => new Date(anno, mese, 0).getDate();
