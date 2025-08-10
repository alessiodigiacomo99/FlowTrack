import { AppState } from "./state.js";

export const SliderHandler = {
    resetCategories() {
        const sliderContainer = document.getElementById("slider-container");
        if (sliderContainer) {
            sliderContainer.remove();
        }

        const slSelectCategoryList = document.getElementById("select-category");
        if (slSelectCategoryList) {
            slSelectCategoryList.remove();
        }
    },

    createCategorySliders() {
        this.resetCategories();
        const categoryList = this.categorizeData();
        const categoryContainer = document.getElementById("categorySliders");

        const select = document.createElement("sl-select");
        select.id = "select-category";
        select.className = "select-category";
        select.setAttribute("placement", "top");
        select.setAttribute("placeholder", "Select Category");
        select.setAttribute("clearable", "true");

        let i = 0;
        let categoryOptions = [];
        categoryList.forEach(cat => {
            const option = document.createElement("sl-option");
            option.value = i;
            option.textContent = cat;
            select.appendChild(option);
            categoryOptions.push(i);
            i++;
        });
        select.setAttribute("value", categoryOptions.toString());
        select.setAttribute("multiple", "true");

        const sliderContainer = document.createElement("div");
        sliderContainer.id = "slider-container";
        sliderContainer.className = "slider-container";
        if (categoryContainer) {
            sliderContainer.innerHTML = "";
            let i = 0;
            categoryList.forEach(category => {
                const row = this.createSliderRow(category, i);
                sliderContainer.appendChild(row);
                i++;
            });

        }
        
        // Show slider on category selection
        select.addEventListener("sl-change", () => {
            let categoryRowList = document.querySelectorAll(".category-row");
            categoryRowList.forEach(sc => {
                sc.classList.add("hidden");
            });

            // Show sliders for selected categories
            let selectedValues = Array.from(document.querySelectorAll("sl-select"))
                .flatMap(sel => sel.value)
                .filter(v => v !== "" && v != null)
                .map(v => parseInt(v, 10));

            selectedValues.forEach(index => {
                categoryRowList[index].classList.remove("hidden");
            });
        });

        categoryContainer.appendChild(select);
        categoryContainer.appendChild(sliderContainer);
    },

    categorizeData() {
        const categoryList = new Set();

        AppState.rawData.forEach((data) => {
            if(data.category){
                categoryList.add(data.category);
            }
        });

        return categoryList;
    },

    createSliderRow(category, number) {
        // Container
        const row = document.createElement("div");
        row.className = "category-row hidden";
        row.setAttribute("data-category", number);


        // Rename field
        const rename = document.createElement("span");
        rename.className = "rename-input";
        rename.contentEditable = "true";
        rename.textContent = category;

        // Slider (range)
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = -100;
        slider.max = 100;
        slider.value = 0;
        slider.step = 1;
        slider.dataset.category = category;
        slider.className = "category-slider";

        // Numeric display
        const display = document.createElement("output");
        display.className = "category-value";
        display.textContent = "0%";
        display.htmlFor = slider.id = `slider-${category}`;

        // Wire slider → display
        slider.addEventListener("input", () => {
            display.textContent = `${slider.value}%`;
        });

        // Assemble
        row.append(rename, slider, display);
        return row;
    },

    getCategoryItemList() {
        let categoryItemList = [];
        let categorySliderList = document.querySelectorAll(".category-slider");
            
        if(categorySliderList.length == 0) {
            return categoryItemList;
        }
        
        let selectedValues = Array.from(document.querySelectorAll("sl-select"))
            .flatMap(sel => sel.value)
            .filter(v => v !== "" && v != null)
            .map(v => parseInt(v, 10));

        selectedValues.forEach(index => {
            let category = categorySliderList[index].dataset.category;
            let percentage = 1 + (parseInt(categorySliderList[index].value, 10) / 100);
            let categoryItem = {
                category: category,
                percentage: percentage
            };
            categoryItemList.push(categoryItem);
        });
        return categoryItemList;
    }

}