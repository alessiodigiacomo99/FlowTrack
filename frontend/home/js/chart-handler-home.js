import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler
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
  Legend,
  Filler
);

export const ChartHandlerHome = {
  
  hexToRgba(hex, alpha = 1) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  renderHomeChart() {

    // read accent color from CSS vars (fallbacks)
    const rootStyle = getComputedStyle(document.documentElement);
    let accent = rootStyle.getPropertyValue('--accent')?.trim() || '#2563eb';
    let accent2 = rootStyle.getPropertyValue('--accent-2')?.trim() || '#06b6d4';

    // sample data: keep your path but make it stable and pretty
    const days = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    const base = 1200;
    const centralForecast = days.map((_, i) => Math.round(base + i * 12 + Math.sin(i / 3) * 60 + (Math.random() * 40 - 20)));
    const upperBound = centralForecast.map(v => Math.round(v + 110 + (Math.random() * 20)));
    const lowerBound = centralForecast.map(v => Math.round(v - 110 - (Math.random() * 20)));

    // compute y bounds and pad them for nicer spacing
    const dataMin = Math.min(...lowerBound);
    const dataMax = Math.max(...upperBound);
    const padding = Math.max(100, Math.round((dataMax - dataMin) * 0.12));
    const suggestedMin = Math.max(0, dataMin - padding);
    const suggestedMax = dataMax + padding;

    const ctx = document.getElementById('forecastChart').getContext('2d');

    // create a smooth vertical gradient for the confidence band
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, this.hexToRgba(accent, 0.16));
    gradient.addColorStop(1, this.hexToRgba(accent2, 0.03));

    // build the chart: order matters!
    // 1) upper band -> fill to next dataset (lower)
    // 2) lower band -> transparent border
    // 3) central forecast line -> drawn on top
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Upper',
            data: upperBound,
            borderColor: 'transparent',
            backgroundColor: gradient,
            fill: '+1', // fill to the next dataset (lower) to create band
            pointRadius: 0,
            tension: 0.4
          },
          {
            label: 'Lower',
            data: lowerBound,
            borderColor: 'transparent',
            backgroundColor: gradient,
            pointRadius: 0,
            tension: 0.4
          },
          {
            label: 'Forecast',
            data: centralForecast,
            borderColor: accent,
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.35,
            cubicInterpolationMode: 'monotone',
            segment: {
              borderDash: ctx => [] // keep the whole line solid; can be customized for projection
            }
          }
        ]
      },
      options: {
        maintainAspectRatio: false, // respects container height
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            padding: 8,
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y ?? ctx.raw;
                return ctx.dataset.label === 'Forecast' ? `Forecast: $${v.toLocaleString()}` : `$${v.toLocaleString()}`;
              }
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        elements: {
          line: {
            borderJoinStyle: 'round',
            borderCapStyle: 'round'
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')?.trim() || '#64748b',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6
            }
          },
          y: {
            grid: {
              color: 'rgba(15,23,36,0.05)',
              drawBorder: false
            },
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')?.trim() || '#64748b',
              callback: (v) => `$${v.toLocaleString()}`
            },
            suggestedMin,
            suggestedMax
          }
        },
        animation: {
          duration: 700,
          easing: 'cubicOut'
        },
        layout: {
          padding: { top: 8, bottom: 6, left: 6, right: 6 }
        }
      }
    });

    // expose chart for debugging in console (optional)
    window._flowtrackForecastChart = chart;
  }
}