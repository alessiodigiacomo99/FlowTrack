import { AppState } from './state.js';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
} from "https://cdn.skypack.dev/chart.js";

// Register the components you use
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

export const ChartHandler = {
  renderForecastChart(forecastData) {
    const ctx = document.getElementById("forecastChart").getContext("2d");

    if (AppState.forecastChart) {
      AppState.forecastChart.destroy();
    }

    const labels = forecastData.map(d => d.date);
    const data = forecastData.map(d => d.amount);

    AppState.forecastChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Balance",
          data,
          borderColor: "#2563eb",
          backgroundColor: "#2563eb22",
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { title: { display: false, text: "Date" } },
          y: { title: { display: true, text: "Balance" } }
        }
      }
    });
  }
}