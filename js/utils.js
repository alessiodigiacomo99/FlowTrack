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

  addRawData(forecastData){
    forecastData.forEach(item => {
      AppState.rawData.push(item);
    })
  },

  updateRunwayStatus(runway) {
    const runwayBox = document.getElementById("runwayBox");
    if (!runwayBox) return;

    if (runway >= 0) {
      runwayBox.textContent = `⚠️ Projected to run out of cash in ${runway} days.`;
      runwayBox.className = "runway warning";
    } else {
      runwayBox.textContent = `✅ Forecast remains positive over the next 30 days.`;
      runwayBox.className = "runway safe";
    }
  }

  
};
