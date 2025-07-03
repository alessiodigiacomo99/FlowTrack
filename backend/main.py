from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid, os, csv
from prophet import Prophet
import pandas as pd
from io import StringIO
app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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



@app.post("/forecast/ai/")
async def forecast_ai(file: UploadFile = File(...), days: int = 30):
    contents = await file.read()
    df = pd.read_csv(StringIO(contents.decode("utf-8")))

    if "date" not in df.columns or "amount" not in df.columns:
        return JSONResponse(content={"error": "CSV must contain 'date' and 'amount' columns."}, status_code=400)

    # Prepare cumulative balance over time
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")
    df["balance"] = df["amount"].cumsum()

    # Prophet expects 'ds' and 'y' columns
    prophet_df = df[["date", "balance"]].rename(columns={"date": "ds", "balance": "y"})

    # Train Prophet
    model = Prophet()
    model.fit(prophet_df)

    # Predict future
    future = model.make_future_dataframe(periods=days)
    forecast = model.predict(future)

    # Return relevant data
    results = forecast[["ds", "yhat"]].tail(days)
    return results.to_dict(orient="records")
