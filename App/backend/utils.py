import joblib

# Load pickle file
def load_pickle(file_path):
    return joblib.load(file_path)