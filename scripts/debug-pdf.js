const fs = require('fs');
const pdf = require('pdf-parse');

async function debugPDF() {
    const dataBuffer = fs.readFileSync('src/assets/PDFs/AMPLIACIONES DE JORNADA.pdf');

    try {
        const data = await pdf(dataBuffer);
        console.log('--- TEXT CONTENT (First 2000 chars) ---');
        console.log(data.text.substring(0, 2000));

        const lines = data.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        console.log('\n--- LAST 10 LINES ---');
        console.log(lines.slice(-10));

        // Look for row 90 as mentioned in the user's report
        const row90 = lines.find(l => l.startsWith('90 '));
        if (row90) {
            console.log('\n--- ROW 90 FOUND ---');
            console.log(row90);
        } else {
            console.log('\n--- ROW 90 NOT FOUND IN SPLIT LINES ---');
            // Search in the whole text
            const row90Index = data.text.indexOf('90 ');
            if (row90Index !== -1) {
                console.log('Row 90 found in raw text at index', row90Index);
                console.log('Context:', data.text.substring(row90Index, row90Index + 100));
            }
        }

        // Look for row 77
        const row77 = lines.find(l => l.startsWith('77 '));
        if (row77) {
            console.log('\n--- ROW 77 FOUND ---');
            console.log(row77);
        }

    } catch (error) {
        console.error('Error parsing PDF:', error);
    }
}

debugPDF();
