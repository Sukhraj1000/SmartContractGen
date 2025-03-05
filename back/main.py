from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
import os
from pydantic import BaseModel

from ai.contract_generator import generate_smart_contract
from ai.contract_updater import integrate_keys_into_contract
from ai.deploy_contract import deploy_contract

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

contracts = {}

class ContractSchema(BaseModel):
    contract_type: str
    contract_name: str
    parameters: dict

@app.post("/api/generate-contract")
async def generate_contract_endpoint(schema: ContractSchema):
    """API endpoint to generate a smart contract"""
    print("Received contract data:", schema.model_dump())

    contract_code = generate_smart_contract(schema)

    if not contract_code:
        return JSONResponse({"error": "AI failed to generate contract"}, status_code=500)

    contract_id = str(uuid4())
    contracts[contract_id] = {"contract": contract_code}

    return JSONResponse({
        "message": "Contract generated successfully.",
        "contract_id": contract_id,
        "contract": contract_code
    })

@app.post("/api/update-contract/{contract_id}")
async def update_contract_endpoint(contract_id: str):
    """API endpoint to update the contract with real keys and program ID."""
    if contract_id not in contracts:
        return JSONResponse({"error": "Contract not found"}, status_code=404)
    
    updated_contract = integrate_keys_into_contract(contracts[contract_id]["contract"])
    
    if not updated_contract:
        return JSONResponse({"error": "AI failed to update contract"}, status_code=500)
    
    contracts[contract_id]["contract"] = updated_contract
    return JSONResponse({"message": "Contract updated successfully."})


@app.post("/api/deploy-contract")
async def deploy_contract_endpoint(schema: ContractSchema, background_tasks: BackgroundTasks):
    """API endpoint to deploy the contract."""
    background_tasks.add_task(deploy_contract)
    return {"message": "Contract deployment started.", "status": "processing"}

@app.get("/api/view-contract/{contract_id}")
async def view_contract(contract_id: str):
    """Returns the generated contract by ID."""
    contract = contracts.get(contract_id, None)
    if not contract:
        return JSONResponse({"error": "Contract not found"}, status_code=404)
    
    return JSONResponse({"contract": contract["contract"]})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
