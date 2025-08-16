import { Utils } from "./utils.js";
import { AppState } from "./state.js";
import { SliderHandler } from "./slider-handler.js";

export const Api = {
  async fetchForecast({ file, days = 30 }) {
    if (!AppState.file) return alert("Upload a CSV file first");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("extra_event_list", JSON.stringify(AppState.timePhasedEvents));
    formData.append("category_item_list", JSON.stringify(SliderHandler.getCategoryItemList()));

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
