import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

# Fix for Razorpay SDK on Python 3.14 (pkg_resources is deprecated)
import sys
from unittest.mock import MagicMock
sys.modules['pkg_resources'] = MagicMock()

from app import create_app

load_dotenv()

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)