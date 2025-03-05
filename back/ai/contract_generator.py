import json
from ai.ai_client import client

CONTRACT_OUTPUT_PATH = "../test-deploy/programs/test-deploy/src/lib.rs"
TEMP_PROGRAM_ID = "11111111111111111111111111111111"  # Temporary program ID


def generate_smart_contract(schema):
    """Generate the smart contract with a placeholder program ID."""
    prompt = f"""
    Create a production-ready Solana smart contract using the Anchor framework.

    CONTRACT DETAILS:
    {json.dumps(schema.dict(), indent=2)}

    REQUIREMENTS:
    - Follow Solana best practices.
    - Include all necessary validation and error handling.
    - Ensure security and deployability for Solana Devnet.
    - Use `{TEMP_PROGRAM_ID}` as a temporary program ID.
    - ONLY define the program module, structs, and function placeholders.
    - Do NOT include any logic for bump seeds, token accounts, or business logic.
    - Ensure the contract is able to compile successfully and can be deployed to retrieve a program ID.
    - Use empty functions (`// TODO: Implement in second stage`).
    - Return only Rust code.

    """

    try:
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4000,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )

        if not response or not response.content or not isinstance(response.content, list):
            print("AI Response error: No valid content received")
            return None

        contract_code = response.content[0].text.strip()
        contract_code = contract_code.replace("```rust", "").replace("```", "").strip()

        if not contract_code:
            print("AI contract generation failed: Empty contract received")
            return None


        # Save contract to file
        with open(CONTRACT_OUTPUT_PATH, "w") as file:
            file.write(contract_code)

        return contract_code

    except Exception as e:
        print(f"AI contract generation error: {str(e)}")
        return None
