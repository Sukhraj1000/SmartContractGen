from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
from pydantic import BaseModel, Field
from enum import Enum
import os
import json
from pathlib import Path

from ai.contract_generator import generate_smart_contract
from ai.contract_updater import smart_contract_build_loop

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# File to persist contracts
CONTRACTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contracts_data.json")

# Ensure required directories exist
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts"), exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "deploy", "programs", "deploy", "src"), exist_ok=True)

# Load existing contracts from file
contracts = {}
if os.path.exists(CONTRACTS_FILE):
    try:
        with open(CONTRACTS_FILE, 'r') as f:
            contracts = json.load(f)
        print(f"Loaded {len(contracts)} contracts from storage")
    except Exception as e:
        print(f"Error loading contracts from file: {e}")

# Function to save contracts to file
def save_contracts():
    try:
        with open(CONTRACTS_FILE, 'w') as f:
            json.dump(contracts, f)
        print(f"Saved {len(contracts)} contracts to storage")
    except Exception as e:
        print(f"Error saving contracts to file: {e}")

class ContractType(str, Enum):
    escrow = "escrow"
    crowdfunding = "crowdfunding"

class ContractSchema(BaseModel):
    contract_type: ContractType
    contract_name: str
    parameters: dict

class BuildDeploySchema(BaseModel):
    contract_type: ContractType
    contract_name: str
    parameters: dict
    max_attempts: int = 5

@app.get("/api/view-contract/{contract_id}")
async def view_contract(contract_id: str):
    """View a generated contract."""
    if contract_id not in contracts:
        return JSONResponse({"error": "Contract not found"}, status_code=404)
    
    contract = contracts[contract_id]
    return JSONResponse({
        "contract": contract["contract"],
        "name": contract.get("name", "Unnamed Contract"),
        "type": contract.get("type", "unknown")
    })

@app.post("/api/build-contract")
async def build_contract_endpoint(schema: BuildDeploySchema):
    """
    Generate a smart contract using the build loop approach that intelligently
    fixes errors until the contract builds successfully. Writes to lib.rs but does
    not deploy the contract.
    """
    try:
        contract_id = str(uuid4())
        
        print(f"Generating {schema.contract_type} contract...")
        
        # Run the smart contract build loop with reduced logging
        success, program_id = smart_contract_build_loop(
            contract_type=schema.contract_type,
            schema=schema.parameters,
            max_attempts=schema.max_attempts
        )
        
        if not success:
            print(f"Contract build failed after {schema.max_attempts} attempts")
            return JSONResponse({
                "error": f"Failed to build contract after {schema.max_attempts} attempts. Check server logs for details."
            }, status_code=500)
        
        # Get the final contract code
        lib_rs_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 
            "..", "deploy", "programs", "deploy", "src", "lib.rs"
        )
        
        if not os.path.exists(lib_rs_path):
            print(f"Contract file not found at {lib_rs_path}")
            return JSONResponse({
                "error": "Contract file not found after build."
            }, status_code=500)
            
        with open(lib_rs_path, 'r') as f:
            contract_code = f.read()
        
        # Store the contract in memory
        contracts[contract_id] = {
            "type": schema.contract_type,
            "name": schema.contract_name,
            "parameters": schema.parameters,
            "contract": contract_code,
            "deployed": False,
            "program_id": program_id,
            "build_success": True
        }
        
        # Save contracts to file
        save_contracts()
        
        print(f"Contract generated successfully - ID: {contract_id}")
        
        return JSONResponse({
            "contract_id": contract_id,
            "program_id": program_id,
            "message": "Contract built successfully. Ready for manual deployment.",
            "build_success": True,
            "lib_rs_path": lib_rs_path
        })
    
    except Exception as e:
        import traceback
        print(f"Build process failed: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": f"Build process failed: {str(e)}"}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
