import { AppState } from "./state.js";
import { Utils } from "./utils.js";
import { Event } from "./event.js";

export const TimePhasedEvents = {
    getEventFormData() {
        return {
            date: document.getElementById("eventDate")?.value || '',
            amount: parseFloat(document.getElementById("eventAmount")?.value || '0'),
            category: document.getElementById("eventCategory")?.value.trim() || ''
        };
    },

    validateEventData({ date, amount, category }) {
        if (!date) {
            return { isValid: false, message: "Please select a date for the event." };
        }
        
        if (isNaN(amount) || amount === 0) {
            return { isValid: false, message: "Please enter a valid amount (positive for income, negative for expense)." };
        }
        
        if (!category) {
            return { isValid: false, message: "Please provide a description for the event." };
        }

        const firstDate = AppState.rawData.map(d => d.date).sort().at(1);
        const lastDate = AppState.rawData.map(d => d.date).sort().at(-1);
        const eventDate = new Date(date);
        const maxDate = Utils.addDays(new Date(lastDate), 30);

        if (eventDate < new Date(firstDate) || eventDate > maxDate) {
            return { isValid: false, message: "Event must be within the next 30 days after your CSV data."};
        }

        return { isValid: true };
    },

    addTimePhasedEvent(eventData) {
        AppState.timePhasedEvents.push({ date: eventData.date, amount: eventData.amount, category: eventData.category });
        this.renderEventList();
    },

    clearEventForm() {
        const eventDate = document.getElementById("eventDate");
        const eventAmount = document.getElementById("eventAmount");
        const eventCategory = document.getElementById("eventCategory");
        
        if (eventDate) eventDate.value = "";
        if (eventAmount) eventAmount.value = "";
        if (eventCategory) eventCategory.value = "";
    },

    renderEventList() {
        const eventList = document.getElementById("eventList");
        if (!eventList) return;

        eventList.innerHTML = "";

        if (!AppState.timePhasedEvents.length) { eventList.innerHTML = '<li class="no-events">No events scheduled</li>';
            return;
        }

        const sortedEvents = [...AppState.timePhasedEvents]
            .sort((a, b) =>
                a.date.localeCompare(b.date)
        );
        sortedEvents.forEach((event, originalIndex) => {
            const listItem = this.createEventListItem(event);
            eventList.appendChild(listItem);

            listItem.querySelector(".delete-btn").addEventListener("click", () => this.deleteEvent(originalIndex));
        });

        
    },

    createEventListItem(event) {
        const li = document.createElement("li");
        li.className = "event-item";

        const amountClass = event.amount >= 0 ? "positive" : "negative";
        const amountSymbol = event.amount >= 0 ? "💰" : "💸";
        const formattedAmount = Utils.formatCurrency(event.amount);

        li.innerHTML = `
            <div class="event-details">
            <span class="event-date">📅 ${Utils.formatDate(event.date)}</span>
            <span class="event-amount ${amountClass}">${amountSymbol} ${formattedAmount}</span>
            <span class="event-category">${Utils.escapeHtml(event.category)}</span>
            </div>
            <button class="delete-btn" title="Delete event">✖</button>
        `;

        return li;
    },

    deleteEvent(index) {
        if (index >= 0 && index < AppState.timePhasedEvents.length) {
            AppState.timePhasedEvents.sort((a, b) =>
                a.date.localeCompare(b.date)
            ).splice(index, 1);
            this.renderEventList();
        }
        Event.handleRunForecast();
    }
};
