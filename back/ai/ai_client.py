import os
from anthropic import Anthropic
from dotenv import load_dotenv, find_dotenv

# Load environment variables
_ = load_dotenv(find_dotenv())

# Initialize AI Client
client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
