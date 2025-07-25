export const FileHandler = {
  parseCSV: text => {
    const [headerLine, ...lines] = text.trim().split('\n');
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
    const rows = lines.map(l => l.split(','));
    return { headers, rows };
  },

  validateCSV: ({ headers }) => {
    const required = ['date', 'amount', 'category'];
    const missing = required.filter(col => !headers.includes(col));
    return missing.length === 0
      ? { isValid: true }
      : { isValid: false, error: `Missing columns: ${missing.join(', ')}` };
  },

  extractValidRows(parsed) {
    const { headers, rows } = parsed;
    return rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  }
};
