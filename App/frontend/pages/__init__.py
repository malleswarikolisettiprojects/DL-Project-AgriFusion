import os, sys
# Ensure the project root (containing the 'App' package) is in sys.path for absolute imports
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
