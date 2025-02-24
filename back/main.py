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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Replace with frontend URL
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
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
class ContractSchema(BaseModel):
    contract_type: str
    contract_name: str
    parameters: dict

@app.post("/api/generate-contract")
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