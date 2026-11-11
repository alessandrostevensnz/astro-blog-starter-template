import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";

execFileSync(process.execPath,["--check","public/report/jsa-app.js"],{stdio:"inherit"});
execFileSync(process.execPath,["--check","public/report/jsa-pdf.js"],{stdio:"inherit"});

const sandbox={window:{}};
runInNewContext(readFileSync("public/report/jsa-pdf.js","utf8"),sandbox);
const p=sandbox.window.ANDROJsaPdf;
assert(p&&typeof p.html==="function"&&typeof p.score==="function");
const matrix=Array.from(p.defaultMatrix, r=>Array.from(r));
assert.equal(p.score({matrix},{likelihood:"Possible",impact:"Severe",initialOverride:""},false),23);
assert.equal(p.score({matrix},{likelihood:"Rare",impact:"Severe",initialOverride:""},false),19);
assert.equal(p.score({matrix},{likelihood:"Unlikely",impact:"Minor",initialOverride:""},false),7);
assert.equal(p.score({matrix},{likelihood:"Almost Certain",impact:"Severe",initialOverride:""},false),25);
assert.equal(p.score({matrix},{likelihood:"",impact:"Severe",initialOverride:""},false),null);
assert.equal(p.score({matrix},{likelihood:"",impact:"",initialOverride:"12"},false),12);
assert.equal(p.score({matrix},{residualLikelihood:"Unlikely",residualImpact:"Moderate",residualOverride:""},true),12);
assert.equal(p.band(5),"risk-low");
assert.equal(p.band(11),"risk-moderate");
assert.equal(p.band(19),"risk-high");
assert.equal(p.band(23),"risk-critical");
assert(p.escapeHtml("<script>")!=="<script>");

const report={
 date:"2026-11-11",jobName:"Example construction job",jobNumber:"JSA-001",
 preparedBy:"Test worker",site:"Auckland site",branch:"ANDRO",building:"Building A",
 description:"Repair",activity:"Carpentry",rescuePlan:"Site-specific rescue plan recorded",
 hazards:[{task:"Example task",hazard:"Working at height",likelihood:"Possible",impact:"Severe",initialOverride:"",
 mitigation:"Site-specific controls recorded",responsible:"Supervisor",
 residualLikelihood:"Unlikely",residualImpact:"Moderate",residualOverride:""}],
 matrix,
 ppe:["Boots"],finalChecks:["Hardware"],
 harnesses:[{user:"Test worker",fit:"Yes",expiry:"01/2027"}],
 members:[{name:"Test worker",role:"Builder",phone:"000 000"}],
 signatures:[{name:"Test worker",date:"2026-11-11",image:""}]
};
const html=p.html(report);
for(const expected of ["Job Safety Analysis","ANDRO CONSTRUCTION LIMITED","Example task","risk-report-table",
  'class="risk-critical">23</td>','class="risk-moderate">12</td>',"pdf-risk-matrix","Site-specific controls recorded",
  "Equipment checks","Team members","Not signed","2026"]) assert(html.includes(expected),"Missing content "+expected);
assert(!html.includes("GOLEMAN GROUP"),"Must not use source company's branding");
console.log("JSA JavaScript syntax + source risk-matrix + PDF layout smoke tests passed.");
