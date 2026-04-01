import sys
import json
import os
import pdfplumber

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file provided"}))
        sys.exit(1)

    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        print(json.dumps({"error": f"File not found: {input_path}"}))
        sys.exit(1)

    try:
        pages_data = []
        with pdfplumber.open(input_path) as pdf:
            for i, page in enumerate(pdf.pages):
                # We extract both tables and raw text
                # Some pages might have a table structure that pdfplumber can't perfectly map
                # but the raw text line-by-line is very consistent.
                
                tables = page.extract_tables(table_settings={
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "snap_y_tolerance": 3,
                    "intersection_tolerance": 3,
                })
                
                text = page.extract_text()
                lines = text.split('\n') if text else []
                
                pages_data.append({
                    "page_number": i + 1,
                    "tables": tables,
                    "lines": lines,
                    "text": text # Keeping full text just in case
                })
        
        print(json.dumps({
            "pages": pages_data,
            "status": "success"
        }))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "status": "error"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
