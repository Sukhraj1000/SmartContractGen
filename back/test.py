import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv, find_dotenv


from anthropic import Anthropic

_ = load_dotenv(find_dotenv())

client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))


prompt = """
fetch test
"""

response = client.messages.create(
    model="claude-3-7-sonnet-20250219",
    max_tokens=4000,
    temperature=0.2,
    messages=[{"role": "user", "content": prompt}]
)

print("AI Response:", response)
