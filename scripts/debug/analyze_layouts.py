import json
import collections

with open('artifacts/pdf-tests/python-extractor-output.json', 'r') as f:
    data = json.load(f)

stats = collections.defaultdict(lambda: collections.defaultdict(int))

for page in data['pages']:
    page_num = page['page_number']
    if page['tables']:
        for table in page['tables']:
            for row in table:
                if row and row[0] and row[0].strip().isdigit():
                    stats[page_num][len(row)] += 1

print("Page layout stats (Page: {col_count: occurrences}):")
for page_num, col_stats in sorted(stats.items()):
    print(f"Page {page_num}: {dict(col_stats)}")
