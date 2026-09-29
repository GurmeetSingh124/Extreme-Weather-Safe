"""
SIHTRACK Server Runner Script
Starts the FastAPI backend with uvicorn.
"""
import sys
import uvicorn

if __name__ == "__main__":
    print("=" * 65)
    print("  SIHTRACK Extreme Weather Intelligence & Tracking Platform")
    print("  SIH26078 - FastAPI Backend Server")
    print("  Operational Endpoints: http://127.0.0.1:8000/api/v1")
    print("  API Documentation:     http://127.0.0.1:8000/docs")
    print("=" * 65)
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)
