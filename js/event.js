import { AppState } from './state.js';
import { Api } from './api.js';
import { ChartHandler } from './chart-handler.js';
import { Utils } from './utils.js';
import { TimePhasedEvents } from './time-phased-events.js';

export const Event = {
    handleAddEvent() {
    const eventData = TimePhasedEvents.getEventFormData();
    const validation = TimePhasedEvents.validateEventData(eventData);
    
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }

    TimePhasedEvents.addTimePhasedEvent(eventData);
    TimePhasedEvents.clearEventForm();
    this.handleRunForecast();
  },

  handleRunForecast() {
    if (!AppState.file) return alert("Upload a CSV file first");

    Api.fetchForecast({
      file: AppState.file,
      extraEvents: AppState.timePhasedEvents,
      days: 30
    })
    .then(res => ChartHandler.renderForecastChart(res))
    .catch(err => {
      console.error(err);
      alert("Forecast failed");
    });
  }
}