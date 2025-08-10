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
      Utils.addRawData(res);
      SliderHandler.createCategorySliders();
      ChartHandler.renderForecastChart(res);
    })
    .catch(err => {
      console.error(err);
      alert("Forecast failed");
    });
  }
  
}