import json
from ai.ai_client import client

def generate_smart_contract(schema):
    """Generate the smart contract with a placeholder program ID."""
    prompt = f"""
    Create a production-ready Solana smart contract using the Anchor framework.

    CONTRACT DETAILS:
    {json.dumps(schema.dict(), indent=2)}

    REQUIREMENTS:
    - Use `"PLACEHOLDER_PROGRAM_ID"` for program ID.
    - Follow Solana best practices.
    - Include all necessary validation and error handling.
    - Ensure security and deployability on Solana Devnet.
    - Return only compilable Rust code.
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

        if not contract_code:
            print("AI contract generation failed: Empty contract received")
            return None

        # Save contract to file
        with open("smart_contract.rs", "w") as file:
            file.write(contract_code)

        return contract_code

    except Exception as e:
        print(f"AI contract generation error: {str(e)}")
        return None
