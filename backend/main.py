import csv
import json
import os
import uuid
from datetime import date as date_cls, timedelta
from io import StringIO
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, File, UploadFile, Query, Body, HTTPException
from fastapi import Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prophet import Prophet
from pydantic import BaseModel, Field

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Item(BaseModel):
    date: date_cls
    amount: float
    category: str = Field(..., description="Category name to adjust")

class ForecastItem(BaseModel):
    date: date_cls
    amount: float

class CategoryItem(BaseModel):
    category: str = Field(..., description="Category name to adjust")
    percentage: float = Field(
        ..., ge=0.0, description="Multiplier to apply (e.g. 1.10 for +10%)"
    )

STORAGE_PATH = "storage"
os.makedirs(STORAGE_PATH, exist_ok=True)

@app.post("/upload-session/")
async def upload_session(
    file: UploadFile,
    revenue_adj: float = Form(...),
    expense_adj: float = Form(...)
):
    session_id = str(uuid.uuid4())
    csv_path = os.path.join(STORAGE_PATH, f"session_{session_id}.csv")

    # Save uploaded file
    with open(csv_path, "wb") as f:
        contents = await file.read()
        f.write(contents)

    # Save metadata
    meta_path = os.path.join(STORAGE_PATH, f"session_{session_id}.meta.csv")
    with open(meta_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["revenue_adj", "expense_adj"])
        writer.writerow([revenue_adj, expense_adj])

    return JSONResponse(content={"session_id": session_id, "status": "saved"})



@app.post(
    "/forecast/ai/",
    response_model=List[ForecastItem],
    summary="Generate a balance forecast with optional extra adjustment",
)
async def forecast_ai(
    file: UploadFile = File(..., description="CSV with ‘date’ and ‘amount’ columns"),
    days: int = Query(30, ge=1, le=365, description="Days to predict into the future"),
    extra_event_list: Optional[str] = Form(None),
    category_item_list: Optional[str] = Form(None)
):
    content = await file.read()
    try:
        df = pd.read_csv(StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")

    # --- Validate required columns ---
    if not {"date", "amount"}.issubset(df.columns):
        raise HTTPException(
            status_code=400,
            detail="CSV must contain both ‘date’ and ‘amount’ columns."
        )

    if category_item_list and "category" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="‘category’ column is required"
        )

    if category_item_list:
        category_item_list = [CategoryItem(**item) for item in json.loads(category_item_list)]
    else:
        category_item_list = []

    parsed_events = []
    if extra_event_list:
        try:
            parsed = json.loads(extra_event_list)
            parsed_events = [Item(**item) for item in parsed]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid extra_event_list: {e}")

    # Prepare cumulative balance over time
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    min_d = df["date"].min()
    max_d = df["date"].max() + timedelta(days=30)  # extend max date by 30 days

    for extra_event in parsed_events:

        if not(min_d.date() <= extra_event.date <= max_d.date()):
                raise HTTPException(
                    status_code=400,
                    detail=f"‘extra_event.date’ ({extra_event.date}) is outside data range "
                           f"{min_d} to {max_d}."
                )

    for cat in category_item_list:
        if cat.category not in df["category"].unique():
            raise HTTPException(
                status_code=400,
                detail=f"Category '{cat.category}' not found in CSV"
            )
        df.loc[df["category"] == cat.category, "amount"] *= cat.percentage

    df["balance"] = df["amount"].cumsum()

    # Prophet expects 'ds' and 'y' columns
    prophet_df = df[["date", "balance"]].rename(columns={"date": "ds", "balance": "y"})

    # Train Prophet
    model = Prophet()
    model.fit(prophet_df)

    # Predict future
    future = model.make_future_dataframe(periods=days)
    forecast = model.predict(future)

    parsed_events.sort(key=lambda ev: ev.date)

    forecast["date"] = forecast["ds"].dt.date
    forecast["adj_yhat"] = forecast["yhat"]  # start with baseline

    for ev in parsed_events:
        ev_ts = pd.to_datetime(ev.date)  # turn Python date -> pd.Timestamp

        # mask on the original 'ds' column, which is safe to compare
        mask = forecast["ds"] >= ev_ts
        forecast.loc[mask, "adj_yhat"] += ev.amount

    # Return relevant data
    out = (
        forecast[["ds", "adj_yhat"]]
        .tail(days)
        .rename(columns={"ds": "date", "adj_yhat": "amount"})
        .assign(date=lambda d: d["date"].dt.date)
    )

    df_history = (
        df[["date", "balance"]]
        .copy()
        .assign(date=lambda d: d["date"].dt.date, amount=lambda d: d["balance"])
        [["date", "amount"]]
    )

    full_data = pd.concat([df_history, out], ignore_index=True)
    return full_data.to_dict(orient="records")