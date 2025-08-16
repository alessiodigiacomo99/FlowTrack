import { AppState } from './state.js';
import { Api } from './api.js';
import { ChartHandler } from './chart-handler.js';
import { TimePhasedEvents } from './time-phased-events.js';
import { SliderHandler } from './slider-handler.js';
import { Utils } from './utils.js';

export const Event = {
    handleAddEvent() {
    const eventData = TimePhasedEvents.getEventFormData();
    const validation = TimePhasedEvents.validateEventData(eventData);
    
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    console.log("Adding event:", eventData);
    TimePhasedEvents.addTimePhasedEvent(eventData);
    TimePhasedEvents.clearEventForm();
    this.handleRunForecast();
  },

  handleRunForecast() {
    Api.fetchForecast({
      file: AppState.file,
      extraEvents: AppState.timePhasedEvents,
      days: 30
    })
    .then(res => {
      document.getElementById("adjustments").style.display = "block";
      document.getElementById("forecast-chart").style.display = "block";
      SliderHandler.createCategorySliders();
      ChartHandler.renderForecastChart(res);
      Utils.addForecastData(res);
      Utils.updateRunwayStatus(res);
    })
    .catch(err => {
      console.error(err);
      alert("Forecast failed");
    });
  },

  downloadCsv(filename, csvContent) {
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    // Create a temporary link element
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);

    // Trigger the download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Free up memory
    URL.revokeObjectURL(url);
}
  
}