function joinWaitlist() {
    alert("Waitlist feature coming soon!");
}

// CSV File Handler - Refactored
class CSVProcessor {
  constructor() {
    this.rawData = [];
    this.categoryAdjustments = {};
    this.categoryRenames = {};
    this.originalForecast = null;
    this.forecastChart = null;
    this.timePhasedEvents = [];
    this.apiBaseUrl = "http://localhost:8000";
    this.requiredColumns = ['date', 'amount', 'category'];
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const csvFileInput = document.getElementById("csvFile");
    if (csvFileInput) {
      csvFileInput.addEventListener("change", (event) => this.handleFileChange(event));
    }
    
    this.initializeEventManagement();
  }

  initializeEventManagement() {
    const addEventBtn = document.getElementById("addEventBtn");
    if (addEventBtn) {
      addEventBtn.addEventListener("click", () => this.handleAddEvent());
    }
    
    this.initializeUtilityButtons();
    
    // Make deleteEvent globally accessible for inline onclick handlers
    window.deleteEvent = (index) => this.deleteEvent(index);
  }

  initializeUtilityButtons() {
    const downloadCsvBtn = document.getElementById("downloadCsvBtn");
    const saveSessionBtn = document.getElementById("saveSessionBtn");
    const runAiForecastBtn = document.getElementById("runAiForecastBtn");
    
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener("click", () => this.downloadForecastCsv());
    }
    
    if (saveSessionBtn) {
      saveSessionBtn.addEventListener("click", () => this.saveSession());
    }
    
    if (runAiForecastBtn) {
      runAiForecastBtn.addEventListener("click", () => this.runAiForecast());
    }
  }

  handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => this.processFileContent(e.target.result);
    reader.onerror = () => this.showError("Error reading file.");
    reader.readAsText(file);
  }

  processFileContent(text) {
    try {
      const parsedData = this.parseCSV(text);
      const validationResult = this.validateData(parsedData);
      
      if (!validationResult.isValid) {
        this.showError(validationResult.error);
        return;
      }

      this.rawData = this.extractValidRows(parsedData);
      
      if (this.rawData.length === 0) {
        this.showError("No valid data found in CSV.");
        return;
      }

      this.resetAdjustments();
      this.createCategorySliders();
      this.setupEventListeners();
      this.updatePreview(text);
      this.originalForecast = this.generateForecast(this.rawData);
      this.renderChartWithGroups(this.originalForecast, [], []);
      this.hideError();

    } catch (error) {
      console.error("CSV Processing Error:", error);
      this.showError("Error parsing CSV.");
    }
  }

  parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    return {
      headers,
      rows: lines.slice(1).map(line => line.split(","))
    };
  }

  validateData({ headers }) {
    const missingColumns = this.requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return {
        isValid: false,
        error: `CSV must have '${this.requiredColumns.join("', '")}' columns. Missing: ${missingColumns.join(", ")}`
      };
    }

    return { isValid: true };
  }

  extractValidRows({ headers, rows }) {
    const dateIndex = headers.indexOf("date");
    const amountIndex = headers.indexOf("amount");
    const categoryIndex = headers.indexOf("category");
    
    return rows
      .map(parts => ({
        date: parts[dateIndex]?.trim(),
        amount: parseFloat(parts[amountIndex]),
        category: parts[categoryIndex]?.trim()
      }))
      .filter(row => 
        row.date && 
        !isNaN(row.amount) && 
        row.category
      );
  }

  resetAdjustments() {
    this.categoryAdjustments = {};
    this.categoryRenames = {};
    
    const sliderContainer = document.getElementById("sliderContainer");
    if (sliderContainer) {
      sliderContainer.innerHTML = "";
    }
  }

  createCategorySliders() {
    const { revenueCategories, expenseCategories } = this.categorizeData();
    
    const revenueContainer = document.getElementById("revenueSliders");
    const expenseContainer = document.getElementById("expenseSliders");
    
    if (revenueContainer && expenseContainer) {
      revenueContainer.innerHTML = "";
      expenseContainer.innerHTML = "";
      
      revenueCategories.forEach(category => {
        const row = this.createSliderRow(category);
        revenueContainer.appendChild(row);
      });

      expenseCategories.forEach(category => {
        const row = this.createSliderRow(category);
        expenseContainer.appendChild(row);
      });
    }
  }

  categorizeData() {
    const revenueCategories = new Set();
    const expenseCategories = new Set();

    this.rawData.forEach(({ category, amount }) => {
      if (amount >= 0) {
        revenueCategories.add(category);
      } else {
        expenseCategories.add(category);
      }
    });

    return { revenueCategories, expenseCategories };
  }

  createSliderRow(category) {
    this.categoryAdjustments[category] = 0;
    this.categoryRenames[category] = category;

    const row = document.createElement("div");
    row.className = "adjustment-row";
    row.innerHTML = `
      <input type="text" 
             class="rename-input" 
             data-original="${category}" 
             value="${category}" 
             placeholder="Category name" />
      <input type="number" 
             value="0" 
             min="-100" 
             max="500" 
             data-category="${category}"
             placeholder="Adjustment %" />
    `;
    return row;
  }

  setupEventListeners() {
    // Debounced event listeners for adjustments
    const adjustmentInputs = document.querySelectorAll("input[data-category]");
    const renameInputs = document.querySelectorAll(".rename-input");
    
    adjustmentInputs.forEach(input => {
      input.addEventListener("input", this.debounce(() => {
        this.applyAdjustments();
      }, 300));
    });

    renameInputs.forEach(input => {
      input.addEventListener("input", this.debounce(() => {
        this.applyAdjustments();
      }, 300));
    });
  }

  updatePreview(text) {
    const previewElement = document.getElementById("csvPreview");
    if (previewElement) {
      const lines = text.trim().split("\n");
      previewElement.textContent = lines.slice(0, 10).join("\n");
    }
  }

  generateForecast(data) {
    const totals = this.aggregateDataByDate(data);
    const forecast = this.calculateCumulativeForecast(totals);
    
    return forecast;
  }

  aggregateDataByDate(data) {
    const totals = {};
    
    // Aggregate data amounts by date
    data.forEach(({ date, amount }) => {
      if (!totals[date]) totals[date] = 0;
      totals[date] += amount;
    });

    // Include time-phased events if they exist
    if (this.timePhasedEvents && this.timePhasedEvents.length > 0) {
      this.timePhasedEvents.forEach(event => {
        if (!totals[event.date]) totals[event.date] = 0;
        totals[event.date] += event.amount;
      });
    }

    return totals;
  }

  calculateCumulativeForecast(totals) {
    const sortedDates = Object.keys(totals).sort();
    let cumulative = 0;
    
    return sortedDates.map(date => {
      cumulative += totals[date];
      return { date, balance: cumulative };
    });
  }

  calculateDailyAverage(forecast) {
    if (forecast.length <= 1) return 0;
    
    const firstBalance = forecast[0].balance;
    const lastBalance = forecast[forecast.length - 1].balance;
    const days = forecast.length;
    
    return (lastBalance - firstBalance) / days;
  }

  getEventAmountForDate(date) {
    if (!this.timePhasedEvents) return 0;
    
    return this.timePhasedEvents
      .filter(event => event.date === date)
      .reduce((sum, event) => sum + event.amount, 0);
  }

  renderChartWithGroups(forecast, revenueData, expenseData) {
    const ctx = document.getElementById("forecastChart")?.getContext("2d");
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.forecastChart) {
      this.forecastChart.destroy();
    }

    // Create and assign new chart
    this.forecastChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: forecast.map(d => d.date),
        datasets: this.createChartDatasets(forecast, revenueData, expenseData)
      },
      options: this.getChartOptions()
    });

    const latestRunway = forecast.at(-1)?.balance ?? 0;
    this.updateRunwayStatus(latestRunway);
  }


  createChartDatasets(forecast, revenueData, expenseData) {
    return [
      {
        label: "Forecast",
        data: forecast.map(d => d.balance),
        borderColor: "#2563eb",
        backgroundColor: "#2563eb22",
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3
      },
      {
        label: "Revenue",
        data: revenueData,
        borderColor: "#22c55e",
        backgroundColor: "#22c55e44",
        fill: false,
        borderWidth: 0,
        pointRadius: 0,
        tension: 0.3
      },
      {
        label: "Expenses",
        data: expenseData,
        borderColor: "#ef4444",
        backgroundColor: "#ef444444",
        fill: false,
        borderWidth: 0,
        pointRadius: 0,
        tension: 0.3
      }
    ];
  }

  getChartOptions() {
    return {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Balance ($)" } }
      }
    };
  }

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

  // Public methods for time-phased events
  setTimePhasedEvents(events) {
    this.timePhasedEvents = events || [];
    this.renderEventList();
  }

  addTimePhasedEvent(date, amount, note = '') {
    if (!this.timePhasedEvents) this.timePhasedEvents = [];
    this.timePhasedEvents.push({ date, amount, note });
    this.renderEventList();
  }

  clearTimePhasedEvents() {
    this.timePhasedEvents = [];
    this.renderEventList();
  }

  // Event management methods
  handleAddEvent() {
    const eventData = this.getEventFormData();
    const validation = this.validateEventData(eventData);
    
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    this.addTimePhasedEvent(eventData.date, eventData.amount, eventData.note);
    this.clearEventForm();
    this.refreshForecast();
  }

  getEventFormData() {
    return {
      date: document.getElementById("eventDate")?.value || '',
      amount: parseFloat(document.getElementById("eventAmount")?.value || '0'),
      note: document.getElementById("eventNote")?.value.trim() || ''
    };
  }

  validateEventData({ date, amount, note }) {
    if (!date) {
      return { isValid: false, message: "Please select a date for the event." };
    }
    
    if (isNaN(amount) || amount === 0) {
      return { isValid: false, message: "Please enter a valid amount (positive for income, negative for expense)." };
    }
    
    if (!note) {
      return { isValid: false, message: "Please provide a description for the event." };
    }
    
    return { isValid: true };
  }

  clearEventForm() {
    const eventDate = document.getElementById("eventDate");
    const eventAmount = document.getElementById("eventAmount");
    const eventNote = document.getElementById("eventNote");
    
    if (eventDate) eventDate.value = "";
    if (eventAmount) eventAmount.value = "";
    if (eventNote) eventNote.value = "";
  }

  renderEventList() {
    const eventList = document.getElementById("eventList");
    if (!eventList) return;
    
    eventList.innerHTML = "";
    
    if (!this.timePhasedEvents.length) {
      eventList.innerHTML = '<li class="no-events">No events scheduled</li>';
      return;
    }
    
    const sortedEvents = [...this.timePhasedEvents].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedEvents.forEach((event, originalIndex) => {
      const listItem = this.createEventListItem(event, originalIndex);
      eventList.appendChild(listItem);
    });
  }

  createEventListItem(event, index) {
    const li = document.createElement("li");
    li.className = "event-item";
    
    const amountClass = event.amount >= 0 ? "positive" : "negative";
    const amountSymbol = event.amount >= 0 ? "💰" : "💸";
    const formattedAmount = this.formatCurrency(event.amount);
    
    li.innerHTML = `
      <div class="event-details">
        <span class="event-date">📅 ${this.formatDate(event.date)}</span>
        <span class="event-amount ${amountClass}">${amountSymbol} ${formattedAmount}</span>
        <span class="event-note">${this.escapeHtml(event.note)}</span>
      </div>
      <button class="delete-btn" onclick="deleteEvent(${index})" title="Delete event">✖</button>
    `;
    
    return li;
  }

  deleteEvent(index) {
    if (index >= 0 && index < this.timePhasedEvents.length) {
      this.timePhasedEvents.splice(index, 1);
      this.renderEventList();
      this.refreshForecast();
    }
  }

  refreshForecast() {
    if (!this.rawData.length) return;
    
    const adjustedData = this.processAdjustedDataForRefresh();
    const adjustedForecast = this.generateForecast(adjustedData);
    const forecast = [...this.originalForecast, ...adjustedForecast];

    const { revenueForecast, expenseForecast } = this.generateRevenueExpenseForecast(adjustedData);
    this.renderChartWithGroups(forecast, revenueForecast, expenseForecast);
  }

  processAdjustedDataForRefresh() {
    return this.rawData.map(({ date, amount, category }) => {
      const percent = this.categoryAdjustments[category] || 0;
      const adjustedAmount = amount >= 0
        ? amount * (1 + percent / 100)
        : amount * (1 - percent / 100);
      return { date, amount: adjustedAmount };
    });
  }

  // Utility methods
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // CSV Download functionality
  downloadForecastCsv() {
    if (!this.forecastChart) {
      alert("No forecast chart available to download.");
      return;
    }

    const csvData = this.generateForecastCsvData();
    if (!csvData) {
      alert("No adjusted forecast data available.");
      return;
    }

    this.downloadCsv(csvData, "adjusted_forecast.csv");
  }

  generateForecastCsvData() {
    const dataset = this.forecastChart.data.datasets.find(ds => ds.label === "Forecast");
    const labels = this.forecastChart.data.labels;
    
    if (!dataset || !labels) return null;

    let csvContent = "date,balance\n";
    for (let i = 0; i < labels.length; i++) {
      const balance = dataset.data[i];
      csvContent += `${labels[i]},${balance.toFixed(2)}\n`;
    }

    return csvContent;
  }

  downloadCsv(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Session save functionality
  async saveSession() {
    const validationResult = this.validateSessionSave();
    if (!validationResult.isValid) {
      alert(validationResult.message);
      return;
    }

    const sessionData = this.prepareSessionData();
    
    try {
      const response = await this.uploadSession(sessionData);
      this.handleSessionSaveResponse(response);
    } catch (error) {
      console.error("Session save error:", error);
      alert("⚠️ Error saving session. Please try again.");
    }
  }

  validateSessionSave() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput?.files[0];

    if (!file) {
      return { isValid: false, message: "Please upload a CSV file first." };
    }

    return { isValid: true };
  }

  prepareSessionData() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];
    
    const revenueAdj = document.getElementById("revenueAdj")?.value || "0";
    const expenseAdj = document.getElementById("expenseAdj")?.value || "0";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("revenue_adj", revenueAdj);
    formData.append("expense_adj", expenseAdj);
    
    // Add time-phased events if they exist
    if (this.timePhasedEvents.length > 0) {
      formData.append("time_phased_events", JSON.stringify(this.timePhasedEvents));
    }

    return formData;
  }

  async uploadSession(formData) {
    const response = await fetch("http://localhost:8000/upload-session/", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  handleSessionSaveResponse(data) {
    if (data.session_id) {
      alert(`✅ Session saved successfully!\nSession ID: ${data.session_id}`);
    } else {
      alert("❌ Failed to save session.");
      console.error("Session save failed:", data);
    }
  }

  // AI Forecast functionality
  async runAiForecast() {
    const validationResult = this.validateAiForecast();
    if (!validationResult.isValid) {
      alert(validationResult.message);
      return;
    }

    const forecastData = this.prepareAiForecastData();
    
    try {
      const aiData = await this.fetchAiForecast(forecastData);
      this.processAiForecastResponse(aiData);
    } catch (error) {
      console.error("AI forecast error:", error);
      alert("Error contacting AI forecast service. Please try again.");
    }
  }

  validateAiForecast() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput?.files[0];

    if (!file) {
      return { isValid: false, message: "Please upload a CSV file first." };
    }

    if (!this.forecastChart) {
      return { isValid: false, message: "No forecast chart available. Please process your data first." };
    }

    return { isValid: true };
  }

  prepareAiForecastData() {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];
    
    const formData = new FormData();
    formData.append("file", file);
    
    return formData;
  }

  async fetchAiForecast(formData) {
    const response = await fetch("http://localhost:8000/forecast/ai/?days=30", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  processAiForecastResponse(aiData) {
    if (!Array.isArray(aiData)) {
      console.error("Unexpected AI response:", aiData);
      alert("AI forecast failed - unexpected response format.");
      return;
    }

    const aiMappedData = aiData.map( d =>{
      const x = new Date(d.ds).toISOString().split("T")[0];
      const y = parseFloat(d.yhat.toFixed(2));
      return {
        date: x, 
        amount: y, 
        category: "AI Forecast"
      };
    });

    this.addAiForecastToChart(aiMappedData);
  }
  
  addAiForecastToChart(aiMappedData) {
    const aiForecast = this.generateForecast(aiMappedData);
    const { revenueForecast, expenseForecast } = this.generateRevenueExpenseForecast(aiForecast);
    const forecast = [...this.originalForecast, ...aiForecast];

    this.renderChartWithGroups(forecast, revenueForecast, expenseForecast);
  }

  // Utility methods for external integrations
  getSessionData() {
    return {
      rawData: this.rawData,
      categoryAdjustments: this.categoryAdjustments,
      categoryRenames: this.categoryRenames,
      timePhasedEvents: this.timePhasedEvents
    };
  }

  setApiBaseUrl(baseUrl) {
    this.apiBaseUrl = baseUrl || "http://localhost:8000";
  }

  async saveSessionToCustomEndpoint(endpoint, additionalData = {}) {
    const sessionData = this.getSessionData();
    const payload = { ...sessionData, ...additionalData };
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  applyAdjustments() {
    if (!this.rawData.length) return;

    const renameMap = this.buildRenameMap();
    const adjustmentMap = this.buildAdjustmentMap(renameMap);
    const adjustedData = this.processAdjustedData(renameMap, adjustmentMap);
    
    const adjustedForecast = this.generateForecast(adjustedData);
    const forecast = [...this.originalForecast, ...adjustedForecast];
    const { revenueForecast, expenseForecast } = this.generateRevenueExpenseForecast(adjustedData);

    this.renderChartWithGroups(
      forecast, 
      revenueForecast, 
      expenseForecast
    );
  }

  buildRenameMap() {
    const renames = {};
    document.querySelectorAll(".rename-input").forEach(input => {
      const original = input.getAttribute("data-original");
      const renamed = input.value.trim();
      renames[original] = renamed;
    });
    return renames;
  }

  buildAdjustmentMap(renameMap) {
    const adjustments = {};
    document.querySelectorAll("input[data-category]").forEach(input => {
      const original = input.getAttribute("data-category");
      const renamed = renameMap[original];
      const adjustment = parseFloat(input.value) || 0;
      adjustments[renamed] = adjustment;
    });
    return adjustments;
  }

  processAdjustedData(renameMap, adjustmentMap) {
    return this.rawData.map(({ date, amount, category }) => {
      const renamed = renameMap[category] || category;
      const percent = adjustmentMap[renamed] || 0;
      const adjustedAmount = amount >= 0
        ? amount * (1 + percent / 100)
        : amount * (1 - percent / 100);
      return { date, amount: adjustedAmount, renamedCategory: renamed };
    });
  }

  generateRevenueExpenseForecast(adjustedData) {
    const dailyTotals = this.aggregateDailyTotals(adjustedData);
    const dates = Object.keys(dailyTotals).sort();
    
    const { revenueHistorical, expenseHistorical } = this.calculateHistoricalCumulatives(dates, dailyTotals);
    
    return {
      revenueForecast: revenueHistorical.map(d => d.value),
      expenseForecast: expenseHistorical.map(d => d.value),
      allDates: dates
    };
  }

  aggregateDailyTotals(adjustedData) {
    const dailyTotals = {};
    adjustedData.forEach(({ date, amount }) => {
      if (!dailyTotals[date]) {
        dailyTotals[date] = { revenue: 0, expense: 0 };
      }
      if (amount >= 0) {
        dailyTotals[date].revenue += amount;
      } else {
        dailyTotals[date].expense += amount;
      }
    });
    return dailyTotals;
  }

  calculateHistoricalCumulatives(dates, dailyTotals) {
    let cumRevenue = 0, cumExpense = 0;
    const revenueHistorical = [];
    const expenseHistorical = [];

    dates.forEach(date => {
      cumRevenue += dailyTotals[date].revenue;
      cumExpense += dailyTotals[date].expense;
      revenueHistorical.push({ date, value: cumRevenue });
      expenseHistorical.push({ date, value: cumExpense });
    });

    return { revenueHistorical, expenseHistorical };
  }

  showError(message) {
    const errorElement = document.getElementById("fileError");
    if (errorElement) {
      errorElement.style.display = "block";
      errorElement.textContent = message;
    }
  }

  hideError() {
    const errorElement = document.getElementById("fileError");
    if (errorElement) {
      errorElement.style.display = "none";
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Public methods for external access
  getRawData() {
    return this.rawData;
  }

  getCategoryAdjustments() {
    return this.categoryAdjustments;
  }

  getCategoryRenames() {
    return this.categoryRenames;
  }
}

// Initialize the CSV processor
const csvProcessor = new CSVProcessor();

// Export for module usage (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVProcessor;
}

