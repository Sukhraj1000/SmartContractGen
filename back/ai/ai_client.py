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
    """Extract code from AI response.
    
    Args:
        response: AI response containing contract code
        
    Returns:
        str: Extracted contract code or None if extraction fails
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

def extract_program_id_from_deployed_contract():
    """Extract program ID from deployed contract.
    
    Returns:
        Program ID string or None if not found.
    """
    try:
        # Method 1: Check program-info.json
        program_info_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                  "deploy", "program-info.json")
        
        if os.path.exists(program_info_path):
            with open(program_info_path, 'r') as f:
                program_info = json.load(f)
                if "programId" in program_info:
                    return program_info["programId"]
                    
        # Method 2: Check lib.rs declare_id! macro
        deploy_lib_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                                "deploy", "programs", "deploy", "src", "lib.rs")
        if os.path.exists(deploy_lib_path):
            with open(deploy_lib_path, "r") as f:
                content = f.read()
                match = re.search(r'declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\);', content)
                if match:
                    return match.group(1)
        
        # Method 3: Get pubkey from keypair file
        keypair_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                              "deploy", "target", "deploy", "deploy-keypair.json")
        if os.path.exists(keypair_path):
            try:
                from subprocess import check_output
                output = check_output(["solana-keygen", "pubkey", keypair_path], text=True)
                return output.strip()
            except Exception as e:
                print(f"Error getting pubkey from keypair: {str(e)}")
                
    except Exception as e:
        print(f"Error extracting program ID: {str(e)}")
        
    return None