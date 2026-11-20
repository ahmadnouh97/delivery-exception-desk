from fastapi import FastAPI

app = FastAPI(title="Delivery Exception Desk")


@app.get("/api/health", operation_id="health")
def health() -> dict[str, str]:
    """Report that the API is running."""
    return {"status": "ok"}
