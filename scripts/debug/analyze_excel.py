import pandas as pd
import json
import sys

def analyze_excel(file_path):
    try:
        xl = pd.ExcelFile(file_path)
        sheets_analysis = {}
        
        for sheet_name in xl.sheet_names:
            # Read first 10 rows to see if headers are misplaced
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=10)
            sheets_analysis[sheet_name] = {
                "first_rows": df.where(pd.notnull(df), None).values.tolist(),
                "shape": pd.read_excel(file_path, sheet_name=sheet_name).shape
            }
        
        analysis = {
            "sheets": sheets_analysis,
            "all_sheet_names": xl.sheet_names
        }
        
        print(json.dumps(analysis, indent=2, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
    else:
        analyze_excel(sys.argv[1])
