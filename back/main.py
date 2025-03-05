<<<<<<< HEAD
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
import os
from fastapi.responses import JSONResponse
from uuid import uuid4
from openai import OpenAI
from dotenv import load_dotenv, find_dotenv
from fastapi.middleware.cors import CORSMiddleware





_ = load_dotenv(find_dotenv())
client = OpenAI(api_key=os.environ.get('OPEN_API_KEY'),
                )
=======
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uuid import uuid4
import os
from pydantic import BaseModel

from ai.contract_generator import generate_smart_contract
from ai.contract_updater import integrate_keys_into_contract
from ai.deploy_contract import deploy_contract
>>>>>>> 016c6a8 (generated keys and addresses with output of smart contracts)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
<<<<<<< HEAD
    allow_origins=["http://localhost:5173"],  # Replace with frontend URL
=======
    allow_origins=["http://localhost:5173"],
>>>>>>> 016c6a8 (generated keys and addresses with output of smart contracts)
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
<<<<<<< HEAD
# Mock Database (Stores contracts temporarily)
contracts = {}

# Parse Legal Document
@app.post("/api/parse-document")
async def parse_document(file: UploadFile = File(...)):
    content = await file.read()
    
    # Mock Parsing Logic (Replace with NLP Model)
    parsed_data = {
        "contract_type": "escrow",
        "contract_name": "Sample Contract",
        "parameters": {
            "amount": "1000 SOL",
            "buyer": "UserA",
            "seller": "UserB",
            "release_condition": "Project completion",
        },
    }

    return {"parsed_data": parsed_data}

# Generate Smart Contract
=======

contracts = {}

>>>>>>> 016c6a8 (generated keys and addresses with output of smart contracts)
class ContractSchema(BaseModel):
    contract_type: str
    contract_name: str
    parameters: dict

@app.post("/api/generate-contract")
<<<<<<< HEAD
async def generate_contract(schema: ContractSchema):
    prompt = f"Create a {schema.contract_type} solana smart contract with the following details: {schema.parameters}"

    response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}]
)

    generated_contract = response.choices[0].message.content
    
    # Generate Contract ID
    contract_id = str(uuid4())
    contracts[contract_id] = {"contract": generated_contract}

    return JSONResponse({"contract_id": contract_id})

# Get Smart Contract Output
@app.get("/api/view-contract/{contract_id}")
async def view_contract(contract_id: str):
    contract = contracts.get(contract_id, None)
    if not contract:
        return JSONResponse({"error": "Contract not found"}, status_code=404)
    return JSONResponse(contract)

# Download Smart Contract as File
@app.get("/api/download-contract/{contract_id}")
async def download_contract(contract_id: str):
    contract = contracts.get(contract_id, None)
    if not contract:
        return JSONResponse({"error": "Contract not found"}, status_code=404)

    filename = f"contract_{contract_id}.txt"
    with open(filename, "w") as f:
        f.write(contract["contract"])

    return JSONResponse({"message": "Contract file ready for download", "file": filename})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
=======
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
>>>>>>> 016c6a8 (generated keys and addresses with output of smart contracts)
