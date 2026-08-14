# Package initializer for ML-Project
import sys

try:
    import App.backend as _backend
    sys.modules['App.backend'] = _backend
except Exception:
    pass

try:
    import App.frontend as _frontend
    sys.modules['App.frontend'] = _frontend
except Exception:
    pass
