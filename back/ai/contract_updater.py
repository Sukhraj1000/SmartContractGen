import json
from ai.ai_client import client

CONFIG_FILE = "../test-config.json"

def integrate_keys_into_contract(contract_code):
    """AI updates the contract with real keys & program ID."""
    prompt = f"""
    Modify the following Solana smart contract to insert the real program ID and keys.

    CONTRACT:
    {contract_code}

    REQUIREMENTS:
    - Replace `"PLACEHOLDER_PROGRAM_ID"` with the real program ID.
    - Ensure all keys are properly assigned.
    - Output only the updated Rust code.
    """

    response = client.messages.create(
        model="claude-3-7-sonnet-20250219",
        max_tokens=4000,
        temperature=0.2,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text if response.content else None
