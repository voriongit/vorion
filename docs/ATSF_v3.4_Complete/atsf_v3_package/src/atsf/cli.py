"""
ATSF CLI Entry Point
"""
import sys
import os

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from atsf_cli import main

if __name__ == "__main__":
    main()
