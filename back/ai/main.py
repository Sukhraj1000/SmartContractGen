import os
import sys
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional, Any

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import local functionality
from ai.contract_generator import generate_smart_contract, extract_program_id_from_deployed_contract
from ai.contract_updater import update_contract

app = FastAPI(title="SmartContractGen API", 
              description="API for generating and updating Solana smart contracts")

class ContractGenerationRequest(BaseModel):
    contract_type: str  # escrow, token_vesting, crowdfunding
    schema: Dict[str, Any]
    program_id: Optional[str] = None  # Optional program ID to use

class ContractUpdateRequest(BaseModel):
    contract_type: str  # escrow, token_vesting, crowdfunding
    contract_code: str  # Existing contract code
    update_requirements: str  # Description of updates needed
    program_id: Optional[str] = None  # Optional program ID to use

class ContractResponse(BaseModel):
    success: bool
    contract_code: Optional[str] = None
    security_score: Optional[float] = None
    message: str
    output_path: Optional[str] = None
    program_id: Optional[str] = None

@app.post("/generate-contract", response_model=ContractResponse)
def generate_contract_endpoint(request: ContractGenerationRequest):
    """
    Generate a new smart contract using AI.
    """
    try:
        # Get target output path (always use the standard Anchor location)
        output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                         "deploy", "programs", "deploy", "src", "lib.rs")
        
        # Use provided program ID or try to find an existing one
        program_id = request.program_id or extract_program_id_from_deployed_contract()
        
        # Generate the contract
        contract_code = generate_smart_contract(
            contract_type=request.contract_type,
            schema=request.schema,
            output_path=output_path
        )
        
        if not contract_code:
            return ContractResponse(
                success=False,
                message="Failed to generate contract",
                output_path=None
            )
            
        # Extract the program ID from the generated contract
        import re
        program_id_match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', contract_code)
        used_program_id = program_id_match.group(1) if program_id_match else program_id
            
        return ContractResponse(
            success=True,
            contract_code=contract_code,
            message=f"Contract generated successfully and saved to {output_path}",
            output_path=output_path,
            program_id=used_program_id
        )
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating contract: {str(e)}")

@app.post("/update-contract", response_model=ContractResponse)
def update_contract_endpoint(request: ContractUpdateRequest):
    """
    Update an existing smart contract using AI.
    """
    try:
        # Get target output path (always use the standard Anchor location)
        output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                         "deploy", "programs", "deploy", "src", "lib.rs")
        
        # Use provided program ID or extract from existing contract
        program_id = request.program_id
        if not program_id:
            # Try to extract from the contract code
            import re
            program_id_match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', request.contract_code)
            if program_id_match:
                program_id = program_id_match.group(1)
            else:
                # Try to find a deployed program ID
                program_id = extract_program_id_from_deployed_contract()
        
        # Update the contract
        updated_code = update_contract(
            contract_type=request.contract_type,
            contract_code=request.contract_code,
            update_requirements=request.update_requirements,
            output_path=output_path
        )
        
        if not updated_code:
            return ContractResponse(
                success=False,
                message="Failed to update contract",
                output_path=None
            )
            
        # Extract the program ID from the updated contract
        program_id_match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', updated_code)
        used_program_id = program_id_match.group(1) if program_id_match else program_id
            
        return ContractResponse(
            success=True,
            contract_code=updated_code,
            message=f"Contract updated successfully and saved to {output_path}",
            output_path=output_path,
            program_id=used_program_id
        )
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error updating contract: {str(e)}")

@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 