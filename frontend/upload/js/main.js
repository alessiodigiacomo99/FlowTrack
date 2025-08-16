import { AppState } from './state.js';
import { FileHandler } from "./file-handler.js";
import { Event } from "./event.js";
import { Utils } from './utils.js';
import { ChartHandler } from './chart-handler.js';

document.getElementById("csvFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  AppState.file = file;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = FileHandler.parseCSV(reader.result);
    const valid = FileHandler.validateCSV(parsed);
    if (!valid.isValid) {
      alert(valid.error);
      return;
    }

    AppState.rawData = FileHandler.extractValidRows(parsed);
  };
  reader.readAsText(file);
  Event.handleRunForecast();
});

document.getElementById("runAiForecastBtn").addEventListener("click", async () => {
  Event.handleRunForecast();
});

document.getElementById("addEventBtn").addEventListener("click", async () => {
  Event.handleAddEvent();
});

document.getElementById("downloadCsvBtn").addEventListener("click", async () => {
  const csvContent = Utils.arrayToCsv(AppState.forecastData);
  const filename = `forecast-${new Date().toISOString()}.csv`;
  Event.downloadCsv(filename, csvContent);
});

document.getElementById("csvFileTrigger").addEventListener("click", async () => {
  const csvContent = Utils.arrayToExampleCsv();
  const filename = "example.csv";
  Event.downloadCsv(filename, csvContent);
});

flatpickr(document.querySelector('#eventDate'), {
  dateFormat: "Y-m-d",
  defaultDate: new Date(),
  monthSelectorType: "static",
  allowInput: true
});

ChartHandler.renderHomeChart();
