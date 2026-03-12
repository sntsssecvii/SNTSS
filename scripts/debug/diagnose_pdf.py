import pdfplumber
import sys
import re

def diagnose(pdf_path):
    print(f"Diagnosing: {pdf_path}")
    total_prog_found = 0
    pages_with_tables = 0
    total_pages = 0
    
    # Pattern for No. Prog at start of line: a number followed by space and then uppercase
    # Actually, in some lists each page restarts at 1, in others it's cumulative.
    # We'll just count how many times we see a line starting with a number that looks like a record.
    
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if not text:
                continue
            
            # Find lines starting with a number
            lines = text.split('\n')
            page_records = 0
            for line in lines:
                # Look for "1 ", "2 ", etc. at the start of the line
                # Often records start with a number, then a name (all caps)
                if re.match(r'^\d+\s+[A-Z/]', line.strip()):
                    page_records += 1
            
            tables = page.find_tables()
            if tables:
                pages_with_tables += 1
            
            total_prog_found += page_records
            if i < 3: # Print sample for first 3 pages
                print(f"Page {i+1}: Found {page_records} record-like lines. Tables detected: {len(tables)}")

    print(f"\nSummary:")
    print(f"Total Pages: {total_pages}")
    print(f"Pages with tables detected: {pages_with_tables}")
    print(f"Total record-like lines found across all pages: {total_prog_found}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        diagnose(sys.argv[1])
    else:
        print("Usage: python diagnose_pdf.py <path_to_pdf>")
