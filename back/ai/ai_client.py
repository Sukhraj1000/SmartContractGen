import os
import re
import json
from anthropic import Anthropic
from dotenv import load_dotenv, find_dotenv

# Load environment variables
_ = load_dotenv(find_dotenv())

# Initialise AI Client
client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

def get_ai_client():
    """Get AI client instance."""
    return client

def extract_code_from_ai_response(response):
    """Extract code from the AI response.
    """
    if not response or not response.content or not isinstance(response.content, list):
        print("AI Response error: No valid content received")
        return None
        
    contract_code = response.content[0].text.strip()
    
    # Remove code block markers if present
    contract_code = contract_code.replace("```rust", "").replace("```", "").strip()
    
    if not contract_code:
        print("AI contract generation failed: Empty contract received")
        return None
        
    return contract_code

def extract_program_id_from_deployed_contract(output=None):
    """
    Try to extract program ID from a previously deployed contract's program-info.json file.
    """
    try:
        # First try to extract from the output if provided
        if output:
            # Look for program ID in the output
            program_id_pattern = r"Program Id: ([a-zA-Z0-9]{43,44})"
            match = re.search(program_id_pattern, output)
            
            if match:
                return match.group(1)
            else:
                # Alternative pattern for different output format
                alt_pattern = r"programId: ([a-zA-Z0-9]{43,44})"
                alt_match = re.search(alt_pattern, output)
                
                if alt_match:
                    return alt_match.group(1)
                
                # Try to find any base58 encoded string that looks like a Solana address
                solana_addr_pattern = r"([1-9A-HJ-NP-Za-km-z]{43,44})"
                addr_matches = re.findall(solana_addr_pattern, output)
                
                if addr_matches:
                    return addr_matches[0]
        
        # If not found in output, try to read from program-info.json
        program_info_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                  "deploy", "program-info.json")
        
        if os.path.exists(program_info_path):
            with open(program_info_path, 'r') as f:
                program_info = json.load(f)
                if "programId" in program_info:
                    return program_info["programId"]
    except Exception as e:
        print(f"Error extracting program ID: {str(e)}")
    
    return None
