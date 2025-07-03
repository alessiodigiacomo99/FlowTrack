let rawData = [], originalForecast = [], forecastChart;
const fileError = document.getElementById("fileError");
const runwayBox = document.getElementById("runwayEstimate");

function joinWaitlist() {
    alert("Waitlist feature coming soon!");
}

function debounce(func, delay) {
    let timeout;
    return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), delay);
    };
}

let categoryAdjustments = {}; // e.g. { 'salary': 0, 'ads': 10 }
const sliderContainer = document.getElementById("categorySliders");

document.getElementById("csvFile").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    try {
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",");
      const dateIndex = headers.indexOf("date");
      const amountIndex = headers.indexOf("amount");
      const categoryIndex = headers.indexOf("category");

      if (dateIndex === -1 || amountIndex === -1 || categoryIndex === -1) {
        fileError.style.display = "block";
        fileError.textContent = "CSV must have 'date', 'amount' and 'category' columns.";
        return;
      }

      rawData = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        const date = parts[dateIndex];
        const amount = parseFloat(parts[amountIndex]);
        const category = parts[categoryIndex].trim();
        if (!isNaN(amount) && category) {
          rawData.push({ date, amount, category });
        }
      }

      if (rawData.length === 0) {
        fileError.style.display = "block";
        fileError.textContent = "No valid data found in CSV.";
        return;
      }

      // Reset adjustments
      categoryAdjustments = {};
      sliderContainer.innerHTML = "";

      const revenueContainer = document.getElementById("revenueSliders");
      const expenseContainer = document.getElementById("expenseSliders");

      categoryAdjustments = {};
      categoryRenames = {}; // global if needed
      revenueContainer.innerHTML = "";
      expenseContainer.innerHTML = "";
      const revenueCategories = new Set();
      const expenseCategories = new Set();

      rawData.forEach(({category, amount}) => {
        if (amount >= 0) revenueCategories.add(category);
        else expenseCategories.add(category);
      });
      function createSliderRow(category) {
        categoryAdjustments[category] = 0;
        categoryRenames[category] = category;

        const row = document.createElement("div");
        row.className = "adjustment-row";
        row.innerHTML = `
          <input type="text" class="rename-input" data-original="${category}" value="${category}" />
          <input type="number" value="0" min="-100" max="500" data-category="${category}" />
        `;
        return row;
      }

      revenueCategories.forEach(cat => {
        const row = createSliderRow(cat);
        revenueContainer.appendChild(row);
      });

      expenseCategories.forEach(cat => {
        const row = createSliderRow(cat);
        expenseContainer.appendChild(row);
      });


      document.querySelectorAll("input[data-category]").forEach(input => {
        input.addEventListener("input", debounce(() => {
          applyAdjustments();
        }, 300));
      });

      document.querySelectorAll(".rename-input").forEach(input => {
        input.addEventListener("input", debounce(() => {
          applyAdjustments();
        }, 300));
      });

      fileError.style.display = "none";
      document.getElementById("csvPreview").textContent = lines.slice(0, 10).join("\n");

      originalForecast = generateForecast(rawData);
      renderChart(originalForecast, originalForecast);
    } catch (err) {
      fileError.style.display = "block";
      fileError.textContent = "Error parsing CSV.";
    }
  };

  reader.readAsText(file);
});

function applyAdjustments() {
  if (!rawData.length) return;

  // Build rename map
  const renameInputs = document.querySelectorAll(".rename-input");
  const renames = {};
  renameInputs.forEach(input => {
    renames[input.getAttribute("data-original")] = input.value.trim();
  });

  // Map adjustments by renamed category
  const adjustments = {};
  document.querySelectorAll("input[data-category]").forEach(input => {
    const original = input.getAttribute("data-category");
    const renamed = renames[original];
    adjustments[renamed] = parseFloat(input.value) || 0;
  });

  // Adjust data amounts with renames and adjustments
  const adjustedData = rawData.map(({ date, amount, category }) => {
    const renamed = renames[category] || category;
    const percent = adjustments[renamed] || 0;
    const adjustedAmount = amount >= 0
      ? amount * (1 + percent / 100)
      : amount * (1 - percent / 100);
    return { date, amount: adjustedAmount, renamedCategory: renamed };
  });

  // Generate total forecast (balance)
  const adjustedForecast = generateForecast(adjustedData);

  // === New logic for revenue & expense forecast ===

  // Aggregate daily revenue and expense totals from adjustedData (historical)
  const dailyTotals = {}; // date => { revenue: x, expense: y }
  adjustedData.forEach(({ date, amount }) => {
    if (!dailyTotals[date]) dailyTotals[date] = { revenue: 0, expense: 0 };
    if (amount >= 0) dailyTotals[date].revenue += amount;
    else dailyTotals[date].expense += amount;
  });

  const dates = Object.keys(dailyTotals).sort();

  // Calculate cumulative sums for historical revenue and expense
  let cumRevenue = 0, cumExpense = 0;
  const revenueHistorical = [];
  const expenseHistorical = [];

  dates.forEach(date => {
    cumRevenue += dailyTotals[date].revenue;
    cumExpense += dailyTotals[date].expense;
    revenueHistorical.push({ date, value: cumRevenue });
    expenseHistorical.push({ date, value: cumExpense });
  });

  // Calculate daily average revenue and expense for forecasting
  const revSum = cumRevenue;
  const expSum = cumExpense;
  const nDays = dates.length || 1;

  const revDailyAvg = revSum / nDays;
  const expDailyAvg = expSum / nDays;

  // Extend revenue and expense forecast forward 30 days
  const MS_PER_DAY = 86400000;
  const lastDate = new Date(dates[dates.length - 1]);

  const revenueForecast = [...revenueHistorical];
  const expenseForecast = [...expenseHistorical];

  for (let i = 1; i <= 30; i++) {
    const newDate = new Date(lastDate.getTime() + MS_PER_DAY * i);
    const isoDate = newDate.toISOString().split("T")[0];

    const lastRev = revenueForecast[revenueForecast.length - 1].value;
    const lastExp = expenseForecast[expenseForecast.length - 1].value;

    revenueForecast.push({ date: isoDate, value: lastRev + revDailyAvg });
    expenseForecast.push({ date: isoDate, value: lastExp + expDailyAvg });
  }

  // Extract arrays for charting
  const revenueSeries = revenueForecast.map(d => d.value);
  const expenseSeries = expenseForecast.map(d => d.value);

  // Dates for chart x-axis (historical + forecast)
  const allDates = revenueForecast.map(d => d.date);
  //renderChart(originalForecast, adjustedForecast);

  renderChartWithGroups(originalForecast, adjustedForecast, allDates, revenueSeries, expenseSeries);
}


function renderChartWithGroups(original, adjusted, dates, revenueData, expenseData) {
  const ctx = document.getElementById("forecastChart").getContext("2d");

  if (forecastChart) forecastChart.destroy();

  forecastChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Original Forecast",
          data: original.map(d => d.balance),
          borderColor: "#2563eb",
          backgroundColor: "#2563eb22",
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 3
        },
        {
          label: "Adjusted Forecast",
          data: adjusted.map(d => d.balance),
          borderColor: "#16a34a",
          backgroundColor: "#16a34a22",
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 3
        },
        {
          label: "Revenue",
          data: revenueData,
          borderColor: "#22c55e",  // green
          backgroundColor: "#22c55e44",
          fill: false,
          borderWidth: 0,   // No line visible
          pointRadius: 0,   // No points visible
          tension: 0.3
        },
        {
          label: "Expenses",
          data: expenseData,
          borderColor: "#ef4444",  // red
          backgroundColor: "#ef444444",
          fill: false,
          borderWidth: 0,   // No line visible
          pointRadius: 0,   // No points visible
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Balance ($)" } }
      }
    }
  });

  if (adjusted.runway >= 0) {
    runwayBox.textContent = `⚠️ Projected to run out of cash in ${adjusted.runway} days.`;
    runwayBox.className = "runway warning";
  } else {
    runwayBox.textContent = `✅ Forecast remains positive over the next 30 days.`;
    runwayBox.className = "runway safe";
  }
}

timePhasedEvents = [];


function generateForecast(data) {
  const totals = {};
  for (const { date, amount } of data) {
    if (!totals[date]) totals[date] = 0;
    totals[date] += amount;
  }

  // Include time-phased events
  for (const event of timePhasedEvents) {
    if (!totals[event.date]) totals[event.date] = 0;
    totals[event.date] += event.amount;
  }

  const sortedDates = Object.keys(totals).sort();
  let cumulative = 0;
  const forecast = sortedDates.map(date => {
    cumulative += totals[date];
    return { date, balance: cumulative };
  });

  const MS_PER_DAY = 86400000;
  const lastDate = new Date(sortedDates[sortedDates.length - 1]);
  const dailyAvg = forecast.length > 1
    ? (forecast[forecast.length - 1].balance - forecast[0].balance) / forecast.length
    : 0;

  const startBalance = cumulative;
  let dayBalance = startBalance;
  let daysUntilZero = -1;

  for (let i = 1; i <= 30; i++) {
    const d = new Date(lastDate.getTime() + MS_PER_DAY * i);
    const iso = d.toISOString().split("T")[0];

    // Add time-phased event if it falls in the projection window
    const eventOnDate = timePhasedEvents.filter(e => e.date === iso);
    const eventAmount = eventOnDate.reduce((sum, e) => sum + e.amount, 0);

    dayBalance += dailyAvg + eventAmount;

    forecast.push({ date: iso, balance: dayBalance });
    if (dayBalance <= 0 && daysUntilZero === -1) {
      daysUntilZero = i;
    }
  }

  forecast.runway = daysUntilZero;
  return forecast;
}


function renderChart(original, adjusted) {
    const ctx = document.getElementById("forecastChart").getContext("2d");

    if (forecastChart) forecastChart.destroy();

    forecastChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: adjusted.map(d => d.date),
        datasets: [
        {
            label: "Original Forecast",
            data: original.map(d => d.balance),
            borderColor: "#2563eb",
            backgroundColor: "#2563eb22",
            fill: false,
            tension: 0.2
        },
        {
            label: "Adjusted Forecast",
            data: adjusted.map(d => d.balance),
            borderColor: "#16a34a",
            backgroundColor: "#16a34a22",
            fill: false,
            tension: 0.2
        }
        ]
    },
    options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Balance ($)" } }
        }
    }
    });

    if (adjusted.runway >= 0) {
    runwayBox.textContent = `⚠️ Projected to run out of cash in ${adjusted.runway} days.`;
    runwayBox.className = "runway warning";
    } else {
    runwayBox.textContent = `✅ Forecast remains positive over the next 30 days.`;
    runwayBox.className = "runway safe";
    }
}

document.getElementById("downloadCsvBtn").addEventListener("click", () => {
  if (!forecastChart) return;

  const dataset = forecastChart.data.datasets.find(ds => ds.label === "Adjusted Forecast");
  const labels = forecastChart.data.labels;

  let csvContent = "date,balance\n";
  for (let i = 0; i < labels.length; i++) {
    csvContent += `${labels[i]},${dataset.data[i].toFixed(2)}\n`;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "adjusted_forecast.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.getElementById("saveSessionBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("csvFile"); // ID of your CSV input
  const file = fileInput.files[0];

  if (!file) {
    alert("Please upload a CSV file first.");
    return;
  }

  const revenueAdj = document.getElementById("revenueAdj").value;
  const expenseAdj = document.getElementById("expenseAdj").value;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("revenue_adj", revenueAdj);
  formData.append("expense_adj", expenseAdj);

  fetch("http://localhost:8000/upload-session/", {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.session_id) {
      alert("✅ Session saved successfully!\nSession ID: " + data.session_id);
    } else {
      alert("❌ Failed to save session.");
      console.error(data);
    }
  })
  .catch(err => {
    console.error("Upload error:", err);
    alert("⚠️ Error saving session.");
  });
});

document.getElementById("runAiForecastBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please upload a CSV file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  fetch("http://localhost:8000/forecast/ai/?days=30", {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(aiData => {
    if (!Array.isArray(aiData)) {
      console.error("Unexpected AI response:", aiData);
      alert("AI forecast failed.");
      return;
    }

    const aiDates = aiData.map(d => d.ds);
    const aiBalances = aiData.map(d => d.yhat.toFixed(2));

    // Add or update the AI dataset
    const existingAiDatasetIndex = forecastChart.data.datasets.findIndex(
      ds => ds.label === "AI Forecast"
    );

    const aiDataset = {
      label: "AI Forecast",
      data: aiBalances,
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.2)",
      borderWidth: 2,
      tension: 0.3
    };

    if (existingAiDatasetIndex !== -1) {
      forecastChart.data.datasets[existingAiDatasetIndex] = aiDataset;
    } else {
      forecastChart.data.datasets.push(aiDataset);
    }

    // Use AI forecast dates for X-axis (if different from original)
    forecastChart.data.labels = aiDates;
    forecastChart.update();
  })
  .catch(err => {
    console.error("AI forecast error:", err);
    alert("Error contacting AI forecast service.");
  });
});

document.getElementById("addEventBtn").addEventListener("click", () => {
  const date = document.getElementById("eventDate").value;
  const amount = parseFloat(document.getElementById("eventAmount").value);
  const note = document.getElementById("eventNote").value.trim();

  if (!date || isNaN(amount) || !note) {
    alert("Please fill in all event fields.");
    return;
  }

  timePhasedEvents.push({ date, amount, note });
  document.getElementById("eventDate").value = "";
  document.getElementById("eventAmount").value = "";
  document.getElementById("eventNote").value = "";

  refreshForecast();
  renderEventList();
});

function renderEventList() {
  const ul = document.getElementById("eventList");
  ul.innerHTML = "";

  timePhasedEvents.sort((a, b) => a.date.localeCompare(b.date));

  timePhasedEvents.forEach((e, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>📅 ${e.date} | 💸 ${e.amount} | ${e.note}</span>
      <button onclick="deleteEvent(${idx})">✖</button>
    `;
    ul.appendChild(li);
  });
}

window.deleteEvent = function(index) {
  timePhasedEvents.splice(index, 1);
  refreshForecast();
  renderEventList();
};

function refreshForecast() {
  if (!rawData.length) return;

  const adjustedData = rawData.map(({ date, amount, category }) => {
    const percent = categoryAdjustments[category] || 0;
    const adjustedAmount = amount >= 0
      ? amount * (1 + percent / 100)
      : amount * (1 - percent / 100);
    return { date, amount: adjustedAmount };
  });

  const adjustedForecast = generateForecast(adjustedData);
  renderChart(originalForecast, adjustedForecast);
}

function generateRecurringInstances(event) {
  const MS_PER_DAY = 86400000;
  const results = [];
  const start = new Date(event.startDate);
  let date = new Date(start);

  const addDays = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 90,
    yearly: 365
  };

  for (let i = 0; i < event.occurrences; i++) {
    const iso = date.toISOString().split("T")[0];
    results.push({ date: iso, amount: event.amount, category: "Recurring: " + event.label });
    date = new Date(date.getTime() + addDays[event.frequency] * MS_PER_DAY);
  }

  return results;
}

