/**
 * Test del parser de cambios de escalafón — lógica inline con fix de adscripciones.
 */

function excelSerialAFecha(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return `${d.getUTCDate().toString().padStart(2,"0")}/${(d.getUTCMonth()+1).toString().padStart(2,"0")}/${d.getUTCFullYear()}`;
}

function excelTimeSerialAHora(n: number): string {
  const t = Math.round(n * 86400);
  return `${Math.floor(t/3600).toString().padStart(2,"0")}:${Math.floor((t%3600)/60).toString().padStart(2,"0")}:${(t%60).toString().padStart(2,"0")}`;
}

const ZONAS_RE = /^\d-(ENSENADA|MEXICALLI|SAN[\s_]+LUIS|TECATE|TIJUANA|INCONDICIONAL)$/i;
const FACILITY_RE = /\b(HOSPITAL|UNIDAD|CLINICA|CENTRO|C\/MF|HGZ|HGR|UMF|COORDINACION|JEFATURA|OFICINA|MODULO)\b/i;

type R = Record<string, unknown>;

function parse(row: (string | number | null)[]): R | null {
  const cells: {idx:number,val:string|number}[] = [];
  for (let i=0;i<row.length;i++) if(row[i]!=null) cells.push({idx:i,val:row[i] as string|number});
  const sv=(v:string|number)=>String(v).trim();

  let fechaRegistro="",fechaIdx=-1;
  for(const{idx,val}of cells){
    if(typeof val==="number"&&val>40000&&val<55000){fechaRegistro=excelSerialAFecha(val);fechaIdx=idx;break;}
    if(typeof val==="string"&&/^\d{2}\/\d{2}\/\d{4}$/.test(val)){fechaRegistro=val;fechaIdx=idx;break;}
  }
  if(!fechaRegistro)return null;

  let horaRegistro="";
  for(const{idx,val}of cells){
    if(idx<=fechaIdx)continue;
    if(typeof val==="number"&&val>0&&val<1){horaRegistro=excelTimeSerialAHora(val);break;}
    if(typeof val==="string"){
      const t=val.trim();
      if(/^\d{2}:\d{2}:\d{2}$/.test(t)){horaRegistro=t;break;}
      const n=parseFloat(t);
      if(!isNaN(n)&&n>0&&n<1){horaRegistro=excelTimeSerialAHora(n);break;}
    }
  }

  let noSolicitud="",noIdx=-1;
  for(const{idx,val}of cells){if(/^[A-Z]\d{5,}$/.test(sv(val))){noSolicitud=sv(val);noIdx=idx;break;}}

  let matricula="",matIdx=-1;
  for(const{idx,val}of cells){
    if(typeof val==="number"){const n=Math.round(val),ns=String(n);if(n>=1_000_000&&ns.length<=11){matricula=ns;matIdx=idx;break;}}
    else{const t=val.trim();if(/^\d{7,11}$/.test(t)&&parseInt(t)>=1_000_000){matricula=t;matIdx=idx;break;}}
  }

  let nombre="",nomIdx=-1;
  for(const{idx,val}of cells){const t=sv(val);if(/[A-ZÁÉÍÓÚÑ]+\/[A-ZÁÉÍÓÚÑ]+\/[A-ZÁÉÍÓÚÑ]/.test(t)){nombre=t.toUpperCase();nomIdx=idx;break;}}

  let zona="",zonaIdx=-1;
  for(const{idx,val}of cells){if(ZONAS_RE.test(sv(val))){zona=sv(val);zonaIdx=idx;break;}}

  // Adscripciones: con zona → separar por posición; sin zona → primera/segunda
  const facs:{idx:number,name:string}[]=[];
  for(const{idx,val}of cells){const t=sv(val);if(FACILITY_RE.test(t)&&t.length>5)facs.push({idx,name:t});}
  let adscripcionOrigen="",adscripcionSolicitada="";
  if(zonaIdx>=0){
    adscripcionOrigen=facs.find(f=>f.idx<zonaIdx)?.name??"";
    adscripcionSolicitada=facs.find(f=>f.idx>zonaIdx)?.name??"";
  }else{
    adscripcionOrigen=facs[0]?.name??"";
    adscripcionSolicitada=facs[1]?.name??"";
  }

  const afterIdx=Math.max(nomIdx,matIdx,noIdx,fechaIdx);
  let especialidadArea=0;
  for(const{idx,val}of cells){
    if(idx<=afterIdx)continue;
    const n=typeof val==="number"?Math.round(val):parseInt(sv(val),10);
    if(!isNaN(n)&&n>=1&&n<=9999&&String(n)!==matricula){especialidadArea=n;break;}
  }

  let tipo="";
  for(const{val}of cells){const t=sv(val).toUpperCase();if(/^(TURNO|ADSCRIPCI[OÓ]N)$/.test(t)){tipo=t.replace("ADSCRIPCION","ADSCRIPCIÓN");break;}}

  let turnoSolicitado="";
  for(const{val}of cells){const t=sv(val).toUpperCase();if(/^(MATUTINO|VESPERTINO|NOCTURNO|INCONDICIONAL|J\.?ACUM\.?|JORNADA\s+ACUMULADA)$/.test(t)){turnoSolicitado=t;break;}}

  let percibeConcepto="",conConceptos="";
  for(const{idx,val}of cells){const t=sv(val).toUpperCase();if(t==="SI"||t==="NO"){if(zonaIdx>=0&&idx<zonaIdx){if(!percibeConcepto)percibeConcepto=t;}else{if(!conConceptos)conConceptos=t;}}}

  return {fechaRegistro,horaRegistro,noSolicitud,matricula,nombre,adscripcionOrigen,percibeConcepto,zona,adscripcionSolicitada,especialidadArea,tipo,turnoSolicitado,conConceptos};
}

// ---- Tests ----
const cases:[string,(string|number|null)[],R|null][]=[
  ['hora string decimal',
    ['31/05/2024','0.426157',null,'E240200196',null,99027031,'ACEVES/RAMIREZ/CESAR FERNANDO',null,null,null,null,'2-MEXICALLI','HOSPITAL DE GINECO PEDIATRIA C/MF 31',null],
    {fechaRegistro:'31/05/2024',horaRegistro:'10:13:40',noSolicitud:'E240200196',matricula:'99027031',nombre:'ACEVES/RAMIREZ/CESAR FERNANDO',zona:'2-MEXICALLI',adscripcionSolicitada:'HOSPITAL DE GINECO PEDIATRIA C/MF 31'}],
  ['sin zona: dos adscripciones',
    ['01/07/2025','0.41022',null,'E250200477',null,98022610,'SANCHEZ/DOMINGUEZ/AIMEE CRISTINA',null,'HOSPITAL DE GINECO PEDIATRIA C/MF 31',null,null,'UNIDAD DE MEDICINA FAMILIAR 16',282,null],
    {fechaRegistro:'01/07/2025',horaRegistro:'09:50:43',noSolicitud:'E250200477',matricula:'98022610',nombre:'SANCHEZ/DOMINGUEZ/AIMEE CRISTINA',adscripcionOrigen:'HOSPITAL DE GINECO PEDIATRIA C/MF 31',adscripcionSolicitada:'UNIDAD DE MEDICINA FAMILIAR 16'}],
  ['nombre en col4',
    ['12/03/2025','0.706146',null,'E250200840','RUBIERA/GUZMAN/IVAN JOSUE',null,98025441,null,null,null,'HOSPITAL DE GINECO PEDIATRIA C/MF 31','2-MEXICALLI',null],
    {fechaRegistro:'12/03/2025',horaRegistro:'16:56:51',noSolicitud:'E250200840',matricula:'98025441',nombre:'RUBIERA/GUZMAN/IVAN JOSUE',zona:'2-MEXICALLI',adscripcionOrigen:'HOSPITAL DE GINECO PEDIATRIA C/MF 31'}],
  ['hora número decimal',
    ['15/06/2025',0.706146,null,'E250200111',null,98011111,'GARCIA/LOPEZ/JUAN',null,null,null,'UNIDAD DE MEDICINA FAMILIAR 10','7-TIJUANA',null],
    {noSolicitud:'E250200111',matricula:'98011111',nombre:'GARCIA/LOPEZ/JUAN',zona:'7-TIJUANA',adscripcionOrigen:'UNIDAD DE MEDICINA FAMILIAR 10',horaRegistro:'16:56:51'}],
  ['tipo y turno',
    ['20/08/2025','0.5',null,'E250100200',null,97055555,'TORRES/MEDINA/ANA',null,'UMF 24','1-ENSENADA','CLINICA DE ENFERMEDADES RESPIRATORIAS','TURNO','MATUTINO','SI'],
    {noSolicitud:'E250100200',zona:'1-ENSENADA',tipo:'TURNO',turnoSolicitado:'MATUTINO',conConceptos:'SI'}],
  ['fila vacía',null as unknown as (string|number|null)[],null],
  ['solo header text',['FECHA','HORA','SOLICITUD','MATRICULA'],null],
];

let pass=0,fail=0;
console.log('=== parsearFilaExcelPorPatron tests ===\n');
for(const[desc,row,expected]of cases){
  const res=row?parse(row):null;
  if(expected===null){
    const ok=res===null;
    console.log(`${ok?'✓':'✗'} [${desc}]: ${ok?'null':'no null'}`);
    ok?pass++:fail++;
    continue;
  }
  if(!res){console.log(`✗ [${desc}]: got null`);fail++;continue;}
  let ok=true;
  for(const[k,v]of Object.entries(expected)){
    if(res[k]!==v){console.log(`  ✗ [${desc}] ${k}: "${res[k]}" !== "${v}"`);ok=false;}
  }
  if(ok){console.log(`✓ [${desc}]`);pass++;}else fail++;
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail>0?1:0);
