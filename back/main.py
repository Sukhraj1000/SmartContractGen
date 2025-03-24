from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
from pydantic import BaseModel
import os
import json
from pathlib import Path

from ai.contract_generator import generate_smart_contract
from ai.contract_updater import integrate_keys_into_contract, smart_contract_build_loop
from ai.deploy_contract import deploy_contract

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Ensure required directories exist
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts"), exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "deploy", "programs", "deploy", "src"), exist_ok=True)

contracts = {}

class ContractSchema(BaseModel):
    contract_type: str
    contract_name: str
    parameters: dict

class BuildDeploySchema(BaseModel):
    contract_type: str
    contract_name: str
    parameters: dict
    max_attempts: int = 5

@app.post("/api/generate-contract")
async def generate_contract_endpoint(schema: ContractSchema):
    """Generate a new smart contract based on the provided schema."""
    try:
        contract_id = str(uuid4())
        
        # Ensure deploy directory exists
        deploy_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "deploy", "programs", "deploy", "src")
        os.makedirs(deploy_dir, exist_ok=True)
        
        contract_code = generate_smart_contract(
            contract_type=schema.contract_type,
            schema=schema.parameters
        )
        
        if not contract_code:
            return JSONResponse({"error": "Failed to generate contract. Check server logs for details."}, status_code=500)
        
        # Store the contract in memory
        contracts[contract_id] = {
            "type": schema.contract_type,
            "name": schema.contract_name,
            "parameters": schema.parameters,
            "contract": contract_code,
            "deployed": False,
            "program_id": None
        }

        return JSONResponse({
            "contract_id": contract_id,
            "message": "Contract generated successfully"
        })
    except Exception as e:
        import traceback
        print(f"Error generating contract: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": f"Failed to generate contract: {str(e)}"}, status_code=500)

@app.post("/api/update-contract/{contract_id}")
async def update_contract_endpoint(contract_id: str):
    """Update a contract with mock program ID and improve quality."""
    if contract_id not in contracts:
        return JSONResponse({"error": "Contract not found"}, status_code=404)

    try:
        contract_data = contracts[contract_id]
        contract_code = contract_data["contract"]
        contract_type = contract_data["type"]

        # Ensure contracts directory exists
        contracts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts", contract_id)
        os.makedirs(contracts_dir, exist_ok=True)
        
        # Update the contract with keys and improve quality
        updated_contract = integrate_keys_into_contract(contract_code, contract_type, contract_id)

        if not updated_contract:
            return JSONResponse({"error": "Contract update failed. Check server logs for details."}, status_code=500)

        # Store the updated contract
        contracts[contract_id]["contract"] = updated_contract
        contracts[contract_id]["updated"] = True
        
        return JSONResponse({
            "contract_id": contract_id,
            "message": "Contract updated successfully"
        })
    except Exception as e:
        import traceback
        print(f"Error updating contract: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": f"Contract update failed: {str(e)}"}, status_code=500)

@app.post("/api/deploy-contract/{contract_id}")
async def deploy_contract_endpoint(contract_id: str, background_tasks: BackgroundTasks):
    """Simulate deployment with mock data."""
    if contract_id not in contracts:
        return JSONResponse({"error": "Contract not found"}, status_code=404)
    
    # Mock deployment for testing
    try:
        # For testing purposes, generate a mock program ID
        import uuid
        mock_program_id = str(uuid.uuid4())[:32].replace('-', '')
        
        # Update contract data with deployment info
        contracts[contract_id]["deployed"] = True
        contracts[contract_id]["program_id"] = mock_program_id
        
        return JSONResponse({
            "program_id": mock_program_id,
            "contract_id": contract_id,
            "message": "Contract successfully deployed (mock deployment)",
            "note": "This is a simulated deployment with mock data"
        })
    except Exception as e:
        import traceback
        print(f"Error deploying contract: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": f"Deployment failed: {str(e)}"}, status_code=500)

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

@app.get("/api/download-contract/{contract_id}")
async def download_contract(contract_id: str):
    """Download a generated contract as text."""
    if contract_id not in contracts:
        return JSONResponse({"error": "Contract not found"}, status_code=404)
    
    return JSONResponse({"contract": contracts[contract_id]["contract"]})

@app.get("/api/contracts")
async def get_all_contracts():
    """Get a list of all contracts."""
    try:
        contracts_list = []
        
        # Add contracts from memory
        for contract_id, contract_data in contracts.items():
            contracts_list.append({
                "id": contract_id,
                "name": contract_data.get("name", "Unnamed"),
                "type": contract_data.get("type", "unknown"),
                "deployed": contract_data.get("deployed", False)
            })
        
        # Sort by name
        contracts_list.sort(key=lambda x: x["name"])
        
        return JSONResponse({"contracts": contracts_list})
    except Exception as e:
        print(f"Error retrieving contracts: {str(e)}")
        return JSONResponse({"error": f"Error retrieving contracts: {str(e)}"}, status_code=500)

@app.post("/api/build-contract")
async def build_contract_endpoint(schema: BuildDeploySchema):
    """
    Generate a smart contract using the build loop approach that intelligently
    fixes errors until the contract builds successfully. Writes to lib.rs but does
    not deploy the contract.
    """
    try:
        contract_id = str(uuid4())
        
        print(f"Starting smart contract build loop for {schema.contract_type}...")
        
        # Run the smart contract build loop
        success, program_id = smart_contract_build_loop(
            contract_type=schema.contract_type,
            schema=schema.parameters,
            max_attempts=schema.max_attempts
        )
        
        if not success:
            return JSONResponse({
                "error": "Failed to build contract after multiple attempts. Check server logs for details."
            }, status_code=500)
        
        # Get the final contract code
        lib_rs_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 
            "..", "deploy", "programs", "deploy", "src", "lib.rs"
        )
        
        if not os.path.exists(lib_rs_path):
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
        
        return JSONResponse({
            "contract_id": contract_id,
            "program_id": program_id,
            "message": "Contract built successfully. Ready for manual deployment.",
            "build_success": True,
            "lib_rs_path": lib_rs_path
        })
    
    except Exception as e:
        import traceback
        print(f"Error in build process: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse({"error": f"Build process failed: {str(e)}"}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
