"""
Extrae el tabulador de sueldos base del contrato colectivo a JSON.
Páginas 91-101 del PDF.

Uso:
    python3 scripts/ops/extract-tabulador.py
"""

import json
import re
import sys
import os

sys.path.insert(0, os.path.join(os.getcwd(), "src", "lib", "pdf", "extractors", "venv", "lib", "python3.13", "site-packages"))

import pdfplumber

PDF_PATH = os.path.join(os.getcwd(), "artifacts", "contrato-colectivo-de-trabajo-2025-2027.pdf")
OUTPUT_PATH = os.path.join(os.getcwd(), "src", "lib", "contract-chat", "tabulador-sueldos.json")

# Pages 91-101 (0-indexed: 90-100)
START_PAGE = 90
END_PAGE = 101


def clean_text(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def parse_number(text):
    if not text:
        return None
    cleaned = text.replace(",", "").replace(" ", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def extract_tabulador():
    entries = []
    current_sector = ""

    with pdfplumber.open(PDF_PATH) as pdf:
        for page_num in range(START_PAGE, END_PAGE + 1):
            if page_num >= len(pdf.pages):
                break

            page = pdf.pages[page_num]
            text = page.extract_text(layout=True) or ""
            lines = text.split("\n")

            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue

                # Skip headers
                if stripped.startswith("TABULADOR DE SUELDOS"):
                    continue
                if stripped.startswith("CATEGORÍA"):
                    continue
                if stripped.startswith("Jor-") or stripped.startswith("nada"):
                    continue
                if stripped.startswith("Sueldo") or stripped.startswith("Hora-Mes") or stripped.startswith("Mes-Pesos"):
                    continue
                if "ESC." in stripped and len(stripped) < 50:
                    continue
                # Skip page numbers, footers
                if re.match(r"^\d{1,3}$", stripped):
                    continue
                if "Índice" in stripped or "Contenido" in stripped or "A-Z" in stripped:
                    continue
                if stripped.startswith("Se firma"):
                    break
                if stripped.startswith("Por el Instituto") or stripped.startswith("Por el Sindicato"):
                    break
                if re.match(r"^(Mtro|Lic|Dra?|Enf|Quím|C\.)\.?\s", stripped):
                    continue
                if any(t in stripped for t in ["Director", "Secretari", "Titular"]):
                    continue
                if "Categorías del extinto" in stripped:
                    continue

                # Check if it's a sector header (ALL CAPS, no numbers)
                if re.match(r"^[A-ZÁÉÍÓÚÑÜ\s\(\)\-,\.\"]+$", stripped) and len(stripped) > 3:
                    # Could be a sector header
                    if not any(c.isdigit() for c in stripped):
                        current_sector = stripped
                        continue

                # Try to parse as a salary row
                # Pattern: category name ... jornada sueldo_hora sueldo_mes escalafon
                # Use right-aligned numbers
                match = re.match(
                    r"^(.+?)\s+([\d\.]+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(\d+|Aut\.?)\s*$",
                    stripped,
                )
                if match:
                    categoria = clean_text(match.group(1))
                    jornada = parse_number(match.group(2))
                    sueldo_hora = parse_number(match.group(3))
                    sueldo_mes = parse_number(match.group(4))
                    escalafon_raw = match.group(5).strip().rstrip(".")

                    entry = {
                        "categoria": categoria,
                        "sector": current_sector,
                        "jornada": jornada,
                        "sueldoHoraMes": sueldo_hora,
                        "sueldoMesPesos": sueldo_mes,
                        "escalafon": int(escalafon_raw) if escalafon_raw.isdigit() else escalafon_raw,
                        "pagina": page_num + 1,
                    }
                    entries.append(entry)
                    continue

                # Some rows have the category spanning multiple columns weirdly
                # Try a more flexible pattern
                match2 = re.match(
                    r"^(.+?)\s+([\d\.]+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$",
                    stripped,
                )
                if match2:
                    categoria = clean_text(match2.group(1))
                    jornada = parse_number(match2.group(2))
                    sueldo_hora = parse_number(match2.group(3))
                    sueldo_mes = parse_number(match2.group(4))

                    entry = {
                        "categoria": categoria,
                        "sector": current_sector,
                        "jornada": jornada,
                        "sueldoHoraMes": sueldo_hora,
                        "sueldoMesPesos": sueldo_mes,
                        "escalafon": "?",
                        "pagina": page_num + 1,
                    }
                    entries.append(entry)
                    continue

                # Residentes have different format
                match3 = re.match(
                    r"^(Residente\s+\(\s*R\s*\d+\s*\))\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$",
                    stripped,
                )
                if match3:
                    entry = {
                        "categoria": clean_text(match3.group(1)),
                        "sector": "MÉDICOS RESIDENTES EN PERÍODO DE ADIESTRAMIENTO",
                        "jornada": None,
                        "sueldoHoraMes": parse_number(match3.group(2)),
                        "sueldoMesPesos": None,
                        "beca": parse_number(match3.group(3)),
                        "totalPesos": parse_number(match3.group(4)),
                        "escalafon": "Aut",
                        "pagina": page_num + 1,
                    }
                    entries.append(entry)

    return entries


def main():
    print(f"Extrayendo tabulador de {PDF_PATH}...")
    entries = extract_tabulador()
    print(f"Categorías extraídas: {len(entries)}")

    if entries:
        # Sort by sueldo mensual descending
        sorted_entries = sorted(
            entries,
            key=lambda e: e.get("sueldoMesPesos") or e.get("totalPesos") or 0,
            reverse=True,
        )
        print(f"\nTop 5 salarios:")
        for e in sorted_entries[:5]:
            sal = e.get("sueldoMesPesos") or e.get("totalPesos") or 0
            print(f"  ${sal:,.2f} - {e['categoria']} ({e['sector']})")

        print(f"\nBottom 5 salarios:")
        for e in sorted_entries[-5:]:
            sal = e.get("sueldoMesPesos") or e.get("totalPesos") or 0
            print(f"  ${sal:,.2f} - {e['categoria']} ({e['sector']})")

    # Save
    output = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(),
        "source": "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
        "pages": "91-101",
        "totalCategorias": len(entries),
        "categorias": entries,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nGuardado en {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
