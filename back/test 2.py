import os
import json
from anthropic import Anthropic

from anthropic import Anthropic

API_KEY = os.getenv("ANTHROPIC_API_KEY")

if not API_KEY:
    raise ValueError("❌ ANTHROPIC_API_KEY is missing. Make sure to set it in your .env file!")

client = Anthropic(api_key=API_KEY)

prompt = """
Create a simple Solana smart contract using the Anchor framework.
The contract should store an escrow agreement.
"""

response = client.messages.create(
    model="claude-3-7-sonnet-20250219",
    max_tokens=4000,
    temperature=0.2,
    messages=[{"role": "user", "content": prompt}]
)

print("AI Response:", response)
