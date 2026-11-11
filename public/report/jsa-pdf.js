/* ANDRO JSA PDF renderer. Self-contained, no third-party dependencies. */
(function () {
  "use strict";
  const likelihoods = ["Almost Certain", "Likely", "Possible", "Unlikely", "Rare"];
  const impacts = ["Insignificant", "Minor", "Moderate", "Major", "Severe"];
  const template = [[5,10,15,21,25],[4,9,14,20,24],[3,8,13,18,23],[2,7,12,17,22],[1,6,11,16,19]];
  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function shown(v) { return v === 0 || (v != null && String(v).trim()) ? String(v) : "Not recorded"; }
  function dateNZ(v) {
    const m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(v||""));
    return m ? m[3]+"/"+m[2]+"/"+m[1] : shown(v);
  }
  function band(v) {
    const n=Number(v);
    if (!Number.isFinite(n)||n<1||n>25) return "risk-empty";
    return n>=20?"risk-critical":n>=13?"risk-high":n>=8?"risk-moderate":"risk-low";
  }
  function score(record, hazard, isResidual) {
    const override=hazard[isResidual?"residualOverride":"initialOverride"];
    if (override!==""&&override!=null&&Number.isFinite(Number(override))&&Number(override)>=1&&Number(override)<=25) return Number(override);
    const lik=likelihoods.indexOf(hazard[isResidual?"residualLikelihood":"likelihood"]);
    const imp=impacts.indexOf(hazard[isResidual?"residualImpact":"impact"]);
    if (lik<0||imp<0) return null;
    const n=Number((record.matrix||template)[lik] && (record.matrix||template)[lik][imp]);
    return Number.isFinite(n) && n>=1 && n<=25 ? n : null;
  }
  function field(name,value) {
    return '<div class="pdf-field"><b>'+escapeHtml(name)+'</b><span>'+escapeHtml(shown(value))+'</span></div>';
  }
  function two(items) { return '<div class="pdf-grid">'+items.join("")+'</div>'; }
  function sec(name) { return '<h2>'+escapeHtml(name)+'</h2>'; }
  function join(v) { return Array.isArray(v)&&v.length?v.join(", "):"Not recorded"; }
  function validImage(data) {
    return typeof data==="string" && /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=]+$/i.test(data) ? data : "";
  }
  function table(headers, rows, className) {
    return '<table class="'+(className||"")+'"><thead><tr>'+
      headers.map(function(s){return '<th scope="col">'+escapeHtml(s)+'</th>';}).join("")+
      '</tr></thead><tbody>'+rows.join("")+'</tbody></table>';
  }
  function cell(s, className) {
    return '<td'+(className?' class="'+className+'"':'')+'>'+escapeHtml(shown(s))+'</td>';
  }
  function build(r) {
    const result=[];
    result.push('<div class="pdf-header"><div><div class="pdf-brand">ANDRO</div><div class="pdf-brand-sub">CONSTRUCTION + PROJECTS · EST. 2020</div></div><div class="pdf-heading"><strong>Job Safety Analysis</strong><span>DATE: '+escapeHtml(dateNZ(r.date))+'</span><span>JOB NAME: '+escapeHtml(shown(r.jobName))+'</span><span>JOB NO: '+escapeHtml(shown(r.jobNumber))+'</span></div></div>');
    result.push('<div class="notice" style="font-size:9pt">Site-specific JSA and risk assessment. All entries require confirmation by the workers and supervisor before the task begins. Blank values mean not recorded, not automatically checked or approved.</div>');
    result.push('<div class="pdf-meta">'+field('JSA prepared by',r.preparedBy)+field('Site / location',r.site)+field('Company / branch',r.branch)+field('Work area / building',r.building)+'</div>');
    result.push(sec("1. Job information"));
    result.push(two([field("Brief description of work",r.description),field("Task / activity",r.activity),field("Hot works",r.hotWorks),field("Qualifications required",r.qualifications),field("Further details of job",r.jobDetails)]));
    result.push(sec("2. Rescue and emergency plan"));
    result.push(two([field("Rescue plan",r.rescuePlan),field("First aid kit location",r.firstAidKit),field("First aiders",r.firstAiders),field("Evacuation route",r.evacuationRoute),field("Emergency assembly point",r.assemblyPoint)]));
    result.push(sec("3. Site controls and preparation"));
    result.push(two([field("PPE required",join(r.ppe)+(r.ppeOther?", "+r.ppeOther:"")),field("Exclusion zone required",r.exclusionZone),field("Site specific regulations / inductions",r.siteRegulations),field("Environmental impact",r.environment),field("Chemicals used on site",r.chemicals),field("Equipment fit for purpose",r.equipmentFit),field("Buddy checks before work",r.buddyChecks),field("Additional site / emergency notes",r.siteNotes)]));
    result.push('<h2 class="page-break">4. Steps taken to carry out task - hazard register</h2>');
    const hazardRows=(r.hazards||[]).map(function(h,i) {
      const initial=score(r,h,false),residual=score(r,h,true);
      return '<tr>'+cell(i+1)+cell(h.task)+cell(h.hazard)+cell(initial===null?"Not assessed":String(initial),band(initial))+
        cell(h.mitigation)+cell(h.responsible)+cell(residual===null?"Not assessed":String(residual),band(residual))+'</tr>';
    });
    result.push('<p class="matrix-note">Initial and residual risk values are generated from the selected likelihood / impact against the matrix below, unless a manual override was entered. A recorded mitigation is not automatically an adequate control.</p>');
    result.push('<table class="risk-report-table"><colgroup><col/><col/><col/><col/><col/><col/><col/></colgroup><thead><tr><th>Step</th><th>Task</th><th>Hazard</th><th>Risk level</th><th>Mitigation / control measures</th><th>Responsible</th><th>Residual risk</th></tr></thead><tbody>'+
       (hazardRows.length?hazardRows.join(""):'<tr><td colspan="7">No hazards recorded. Assessment incomplete.</td></tr>')+'</tbody></table>');
    result.push('<h2 class="page-break">5. Risk rating matrix</h2>');
    result.push('<p>Likelihood / consequence scoring using the 5×5 matrix selected for this report. Check the ratings and colour bands against the applicable site risk assessment procedure.</p>');
    const matrix=(Array.isArray(r.matrix)&&r.matrix.length===5)?r.matrix:template;
    const rows=likelihoods.map(function(label,i) {
      return '<tr><th scope="row">'+escapeHtml(label)+'</th>'+impacts.map(function(_,j) {
        const n=Number(matrix[i]&&matrix[i][j]);
        return cell(Number.isFinite(n)&&n>=1&&n<=25?n:"-",band(n));
      }).join("")+'</tr>';
    });
    result.push(table(["Likelihood / impact"].concat(impacts),rows,"pdf-risk-matrix"));
    result.push('<p class="matrix-note"><b>Legend:</b> Low (1–7) · Moderate (8–12) · High (13–19) · Critical (20–25). These categories are editable project defaults, not a substitute for site or company approval.</p>');
    result.push(two([field("Risk criteria / method notes",r.matrixNotes)]));
    result.push(sec("6. Final equipment and competency checks"));
    result.push(two([
      field("Checks suitable for task",join(r.finalChecks)),
      field("Trained and competent for task",r.trainedCompetent),
      field("Using rope access or fall arrest equipment",r.fallArrest),
      field("Electrical equipment has an in-date tag",r.electricalTags)
    ]));
    result.push(sec("Equipment checks / harness tags"));
    result.push(table(["Name / user","Fit for purpose","Harness tag expiry"],(r.harnesses||[]).map(function(h) {
      return '<tr>'+cell(h.user)+cell(h.fit)+cell(h.expiry)+'</tr>';
    }),""));
    result.push(sec("7. Team members on site"));
    result.push(table(["Full name","Role","Phone number"],(r.members||[]).map(function(m) {
      return '<tr>'+cell(m.name)+cell(m.role)+cell(m.phone)+'</tr>';
    }),""));
    result.push(sec("8. Team acknowledgment and signatures"));
    result.push('<p>I confirm I have reviewed and understood the requirements recorded in this JSA and will follow its identified controls, subject to site-specific briefing and approval.</p>');
    const signs=(r.signatures||[]);
    result.push(signs.map(function(s) {
      const img=validImage(s.image);
      return '<div class="pdf-sig">'+(img?'<img src="'+img+'" alt="Recorded signature"/>':'<div style="height:62px;color:#888">Not signed</div>')+
        '<div class="line"><b>'+escapeHtml(shown(s.name))+'</b> · '+escapeHtml(dateNZ(s.date))+'</div></div>';
    }).join(""));
    result.push(sec("9. Approvals, permit and follow-up"));
    result.push(two([
      field("Site supervisor",r.supervisor),field("Work allocated by",r.allocatedBy),field("WorkSafe notification required",r.workSafe),
      field("Work permit required",r.permitRequired),field("Weather",(r.weather||"")+(r.weather==="Other"&&r.weatherOther?" - "+r.weatherOther:"")),
      field("Email copy recipient",r.copyEmail),field("Relaunch tomorrow requested",r.relaunchTomorrow),
      field("Relaunch recipient email",r.relaunchEmail),field("Additional email recipients",r.additionalRecipients),
      field("Additional notes and limitations",r.finalNotes)
    ]));
    const photo=validImage(r.permitPhoto);
    if(photo){result.push(sec("Permit photograph"));result.push('<img class="permit" src="'+photo+'" alt="Attached work permit photograph"/>');}
    result.push('<div class="pdf-footer">ANDRO CONSTRUCTION LIMITED · ANDRO.CO.NZ · EST. 2020<br/>This PDF records the entered JSA. It is not evidence of WorkSafe notification, permit approval, training or compliance on its own.</div>');
    return result.join("");
  }
  window.ANDROJsaPdf={
    html:build,
    score:score,
    band:band,
    escapeHtml:escapeHtml,
    likelihoods:likelihoods,
    impacts:impacts,
    defaultMatrix:template
  };
})();
