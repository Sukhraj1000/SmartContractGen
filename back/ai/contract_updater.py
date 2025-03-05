import json
from ai.ai_client import client
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))  # Get script's directory

CONFIG_FILE = os.path.join(BASE_DIR, "../../back/test-config.json")  
CONTRACT_OUTPUT_PATH = os.path.join(BASE_DIR, "../../test-deploy/programs/test-deploy/src/lib.rs")
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary placeholder ID


def integrate_keys_into_contract(contract_code):
    """AI updates the contract with real keys & program ID."""
    print(f"Looking for config file at: {CONFIG_FILE}")
    if not os.path.exists(CONFIG_FILE):
        print("Error: test-config.json does not exist at the specified path.")

    try:
        # Load updated program ID
        with open(CONFIG_FILE, "r") as file:
            config_data = json.load(file)

        program_id = config_data.get("programId", "").strip()

        if not program_id:
            print("Error: programId not found in test-config.json")
            return None

        print(f"Updating contract with Program ID: {program_id}")

        prompt = f"""
        Modify the following Solana smart contract to insert the real program ID and update all necessary keys.

        CONTRACT:
        {contract_code}

        JSON CONFIG:
        {json.dumps(config_data, indent=2)}

        REQUIREMENTS:
        - Replace `{TEMP_PROGRAM_ID}` with `{program_id}`.
        - Ensure all public keys are correctly assigned from JSON CONFIG.
        - Preserve contract structure and security best practices.
        - Output only valid Rust code.
        """

        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        if not response or not response.content or not isinstance(response.content, list):
            print("Error: AI response is empty or invalid.")
            return None

        updated_contract = response.content[0].text.strip()

        if not updated_contract:
            print("Error: AI-generated contract is empty.")
            return None

        # Save updated contract
        with open(CONTRACT_OUTPUT_PATH, "w") as file:
            file.write(updated_contract)

        print(f"✅ Contract updated and saved to {CONTRACT_OUTPUT_PATH}")
        return updated_contract

    except Exception as e:
        print(f"Error during contract update: {str(e)}")
        return None