import { AppState } from "./state.js";

export const Utils = {
  apiBaseUrl : 'http://localhost:8081/',
  
  formatCurrency: amount => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(Math.abs(amount)),

  formatDate: dateStr => new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }),

  escapeHtml: text => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  addForecastData(forecastData){
    AppState.forecastData = [];
    forecastData.forEach(item => {
      AppState.forecastData.push(item);
    })
  },

  updateRunwayStatus(transactions) {
    const runwayBox = document.getElementById("runwayBox");
    if (!runwayBox) return;

    // Sort by date to ensure correct order
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    let daysUntilNegative = null;

    for (let i = 0; i < sorted.length; i++) {
        balance = sorted[i].amount;
        if (balance <= 0 && daysUntilNegative === null) {
            const today = new Date(sorted[0].date);
            const negativeDate = new Date(sorted[i].date);
            const diffDays = Math.ceil((negativeDate - today) / (1000 * 60 * 60 * 24));
            daysUntilNegative = diffDays;
        }
    }

    // Shoelace style display
    runwayBox.className = "runway-box"; // reset class

    if (daysUntilNegative !== null) {
        runwayBox.innerHTML = `
            <sl-alert variant="warning" open>
                ⚠️ Projected to run out of cash in <strong>${daysUntilNegative}</strong> days.
            </sl-alert>
        `;
    } else {
        runwayBox.innerHTML = `
            <sl-alert variant="success" open>
                ✅ Forecast remains positive over the next 30 days.
            </sl-alert>
        `;
    }
  },

  arrayToCsv(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return "";
    }

    const enrichedData = data.map(item => ({
        ...item,
        category: "balance"
    }));

    // Get headers from object keys
    const headers = Object.keys(enrichedData[0]);

    // Map rows
    const rows = enrichedData.map(obj =>
        headers.map(header => `"${String(obj[header]).replace(/"/g, '""')}"`).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  },

  arrayToExampleCsv() {
    const sampleData = [
      { date: '2024-01-01', amount: '3000', category: 'Client Payment' },
      { date: '2024-01-02', amount: '1500', category: 'Consulting' }
    ];
    

    // Get headers from object keys
    const headers = Object.keys(sampleData[0]);

    // Map rows
    const rows = sampleData.map(obj =>
        headers.map(header => `"${String(obj[header]).replace(/"/g, '""')}"`).join(",")
    );

    // Join headers and rows
    return [headers.join(","), ...rows].join("\n");
}

  
};
