import { Utils } from "./utils.js";
import { AppState } from "./state.js";

export const Api = {
  async fetchForecast({ file, days = 30 }) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("extra_event_list", JSON.stringify(AppState.timePhasedEvents));

    const res = await fetch(`${Utils.apiBaseUrl}forecast/ai/?days=${days}`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    return await res.json();
  }
};
