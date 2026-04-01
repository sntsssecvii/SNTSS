const line = "1 VEGA/DELGADO/SYLVIA LILIANA 98029240 10/10/2022 2022003 99.990 8 539 A CAMBIO DE ZONA AUT SCMBT 10/10/2022";
const regex = /^(\d+)\s+([A-ZÁÉÍÓÚÑ/&\s]+)\s+(\d{7,10})\s+(\d{2}\/\d{2}\/\d{4})(.*)$/;
const match = line.match(regex);
if (match) {
    console.log("Match found!");
    console.log("NumProg:", match[1]);
    console.log("Nombre:", match[2]);
    console.log("Matricula:", match[3]);
    console.log("Fecha:", match[4]);
} else {
    console.log("No match");
    // Debug why
    const step1 = line.match(/^(\d+)\s+(.*)$/);
    if (step1) {
        console.log("Step 1 (prog + rest):", step1[1], "||", step1[2]);
        const rest = step1[2];
        const step2 = rest.match(/^([A-ZÁÉÍÓÚÑ/&\s]+)\s+(\d{7,10})\s+(.*)$/);
        if (step2) {
            console.log("Step 2 (name + mat + rest):", step2[1], "||", step2[2], "||", step2[3]);
        } else {
            console.log("Step 2 failed");
        }
    }
}
