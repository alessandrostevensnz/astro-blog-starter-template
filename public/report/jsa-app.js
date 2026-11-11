/* ANDRO JSA editor - isolated from the existing Property/Works reports. */
(function () {
  "use strict";
  const PDF = window.ANDROJsaPdf;
  if (!PDF) { document.body.innerHTML='<p style="padding:25px">The JSA PDF module did not load. Please refresh.</p>'; return; }
  const $ = function (sel,root) { return (root||document).querySelector(sel); };
  const $$ = function (sel,root) { return Array.from((root||document).querySelectorAll(sel)); };
  const esc = PDF.escapeHtml;
  const DB_NAME = "andro-jsa-risk-reports-v1", STORE = "jsa-reports";
  const PPE = ["Hi Viz","Boots","Rope Access Gear","Hard Hat","Mask","Gloves","Eye protection","Hearing protection"];
  const FINAL = ["Hardware","Helmet","Equipment","Rope","Harness"];
  const WEATHER = ["Rain","Sun","Wind","Snow","Dark","Other"];
  let db=null, current=null, step=0, saveTimer=0, printingTitle="";
  const today = function () {
    const d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  };
  const uid = function () { return typeof crypto!=="undefined"&&crypto.randomUUID ? crypto.randomUUID() : "jsa-"+Date.now()+"-"+Math.random().toString(36).slice(2); };
  const copy = function (v) { return JSON.parse(JSON.stringify(v)); };
  const emptyHazard = function () {return {id:uid(),task:"",hazard:"",likelihood:"",impact:"",initialOverride:"",mitigation:"",responsible:"",residualLikelihood:"",residualImpact:"",residualOverride:""};};
  const blankHarness=function () {return {id:uid(),user:"",fit:"",expiry:""};};
  const blankMember=function () {return {id:uid(),name:"",role:"",phone:""};};
  const blankSign=function () {return {id:uid(),name:"",date:today(),image:""};};
  function blank() {
    return {
      id:uid(),updated:Date.now(),version:1,date:today(),
      preparedBy:"",jobName:"",jobNumber:"",site:"",branch:"",building:"",description:"",
      hotWorks:"",activity:"",qualifications:"",jobDetails:"",rescuePlan:"",firstAidKit:"",firstAiders:"",
      evacuationRoute:"",assemblyPoint:"",exclusionZone:"",ppe:[],ppeOther:"",siteRegulations:"",
      environment:"",chemicals:"",equipmentFit:"",buddyChecks:"",siteNotes:"",
      hazards:[emptyHazard()],matrix:copy(PDF.defaultMatrix),matrixNotes:"",
      finalChecks:[],trainedCompetent:"",fallArrest:"",harnesses:[],electricalTags:"",
      members:[blankMember()],signatures:[blankSign()],supervisor:"",allocatedBy:"",
      workSafe:"",permitRequired:"",permitPhoto:"",weather:"",weatherOther:"",
      copyEmail:"",relaunchTomorrow:"",relaunchEmail:"",additionalRecipients:"",finalNotes:""
    };
  }
  function normalize(raw) {
    const def=blank();
    const r=Object.assign(def,raw||{});
    r.ppe=Array.isArray(r.ppe)?r.ppe:[];
    r.finalChecks=Array.isArray(r.finalChecks)?r.finalChecks:[];
    r.hazards=Array.isArray(r.hazards)?r.hazards.map(function(x){return Object.assign(emptyHazard(),x);}):[emptyHazard()];
    r.harnesses=Array.isArray(r.harnesses)?r.harnesses.map(function(x){return Object.assign(blankHarness(),x);}):[];
    r.members=Array.isArray(r.members)?r.members.map(function(x){return Object.assign(blankMember(),x);}):[];
    r.signatures=Array.isArray(r.signatures)?r.signatures.map(function(x){return Object.assign(blankSign(),x);}):[];
    const validMatrix=Array.isArray(r.matrix)&&r.matrix.length===5&&r.matrix.every(function(row){return Array.isArray(row)&&row.length===5&&row.every(function(n){return Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=25;});});
    if(!validMatrix) r.matrix=copy(PDF.defaultMatrix);
    return r;
  }
  function openDB() {
    return new Promise(function(resolve,reject){
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"id"});};
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){reject(req.error||Error("IndexedDB unavailable"));};
    });
  }
  function request(q) {return new Promise(function(resolve,reject){q.onsuccess=function(){resolve(q.result);};q.onerror=function(){reject(q.error);};});}
  function table(mode) {return db.transaction(STORE,mode||"readonly").objectStore(STORE);}
  function getAll(){return request(table().getAll());}
  function get(id){return request(table().get(id));}
  function put(r){return request(table("readwrite").put(r));}
  function remove(id){return request(table("readwrite").delete(id));}
  function status(s){$("#save-status").textContent=s;}
  function saveSoon(){
    if(!current)return;
    current.updated=Date.now();
    status("Saving locally...");
    clearTimeout(saveTimer);
    saveTimer=setTimeout(function(){saveNow();},380);
  }
  async function saveNow(){
    clearTimeout(saveTimer);saveTimer=0;
    if(!current)return;
    try {await put(current);status("Saved locally");}
    catch(e){status("Could not save: "+e.message);alert("JSA storage error. Export a backup before closing this page. "+e.message);}
  }
  function download(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }
  function filename(s) {return String(s||"Site").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,48)||"Site";}
  async function dashboard(){
    clearTimeout(saveTimer);
    if(current)await saveNow();
    current=null;
    $("#editor").hidden=true;$("#dashboard").hidden=false;
    window.scrollTo(0,0);
    const reports=(await getAll()).sort(function(a,b){return (b.updated||0)-(a.updated||0);});
    const root=$("#saved-jsas");
    root.classList.toggle("empty",!reports.length);
    root.innerHTML=reports.length?reports.map(function(r){
      return '<div class="record"><div><strong>'+esc(r.jobName||r.site||"Untitled JSA")+'</strong><span>'+esc(r.jobNumber||"No job number")+
      ' · '+esc(r.site||"No site")+' · '+esc(r.date||"No date")+' · '+(r.hazards||[]).length+' hazard entries</span></div>'+
      '<div class="buttons"><button class="btn secondary" type="button" data-open-jsa="'+esc(r.id)+'">Open JSA</button>'+
      '<button class="btn ghost" type="button" data-delete-saved="'+esc(r.id)+'">Delete</button></div></div>';
    }).join(""):"No JSA reports saved yet. Create a new report to begin.";
  }
  function choices(root, values, selected, attr, name) {
    root.innerHTML=values.map(function(v){
      return '<label><input type="'+(attr==="data-weather"?"radio":"checkbox")+'" '+attr+'="'+esc(name||v)+'" value="'+esc(v)+'"'+
      (selected&&(Array.isArray(selected)?selected.includes(v):selected===v)?' checked':'')+' /> '+esc(v)+'</label>';
    }).join("");
  }
  function optionList(values,value,label) {
    return '<option value="">'+esc(label||"Select")+'</option>'+values.map(function(v){
      return '<option value="'+esc(v)+'"'+(v===value?' selected':'')+'>'+esc(v)+'</option>';
    }).join("");
  }
  function fieldInput(label,field,val,kind,placeholder){
    return '<div class="field"><label>'+esc(label)+
      (kind==="textarea"?'<textarea data-h-field="'+field+'" placeholder="'+esc(placeholder||"")+'">'+esc(val||"")+'</textarea>':
      '<input data-h-field="'+field+'" value="'+esc(val||"")+'" placeholder="'+esc(placeholder||"")+'"'+(kind==="number"?' inputmode="numeric" type="number" min="1" max="25"':'')+' />')+'</label></div>';
  }
  function selField(label,field,val,opts){
    return '<div class="field"><label>'+esc(label)+'<select data-h-field="'+field+'">'+optionList(opts,val)+'</select></label></div>';
  }
  function hazardHtml(h,i){
    const initial=PDF.score(current,h,false),residual=PDF.score(current,h,true);
    return '<article class="entry" data-hazard-index="'+i+'"><div class="entry-head"><h3>Step '+(i+1)+' · Task and hazard</h3>'+
      '<div class="buttons"><button class="btn secondary" data-hazard-action="up" type="button"'+(i===0?' disabled':'')+'>Move up</button>'+
      '<button class="btn secondary" data-hazard-action="down" type="button"'+(i>=current.hazards.length-1?' disabled':'')+'>Move down</button>'+
      '<button class="btn secondary" data-hazard-action="duplicate" type="button">Duplicate</button>'+
      '<button class="btn danger" data-hazard-action="delete" type="button">Remove</button></div></div>'+
      '<div class="fields">'+fieldInput("Task to be carried out","task",h.task,"input","e.g. Roof access")+
      fieldInput("Hazard","hazard",h.hazard,"input","e.g. Slips, trips or falls")+'</div>'+
      '<h4>Initial risk assessment</h4><div class="fields three">'+selField("Likelihood","likelihood",h.likelihood,PDF.likelihoods)+
      selField("Consequence / impact","impact",h.impact,PDF.impacts)+fieldInput("Manual score override (optional)","initialOverride",h.initialOverride,"number","1–25")+'</div>'+
      '<div class="risk-result"><b>Initial risk level</b><span class="risk-badge '+PDF.band(initial)+'" data-risk-display="initial">'+(initial==null?"Not assessed":initial)+'</span></div>'+
      '<div class="fields" style="margin-top:13px">'+fieldInput("Mitigation / control measures","mitigation",h.mitigation,"textarea","Write the controls for this actual site and task.")+
      fieldInput("Responsible person / team","responsible",h.responsible,"input","Name or team responsible")+'</div>'+
      '<h4>Residual risk after controls</h4><div class="fields three">'+selField("Likelihood after controls","residualLikelihood",h.residualLikelihood,PDF.likelihoods)+
      selField("Impact after controls","residualImpact",h.residualImpact,PDF.impacts)+
      fieldInput("Manual residual score (optional)","residualOverride",h.residualOverride,"number","1–25")+'</div>'+
      '<div class="risk-result"><b>Residual risk level</b><span class="risk-badge '+PDF.band(residual)+'" data-risk-display="residual">'+(residual==null?"Not assessed":residual)+'</span></div></article>';
  }
  function renderHazards(){ $("#hazard-rows").innerHTML=current.hazards.map(hazardHtml).join("")||'<div class="empty">No hazards recorded. Add a task and hazard.</div>'; }
  function updateRiskBadges(){
    $$("[data-hazard-index]",$("#hazard-rows")).forEach(function(el){
      const h=current.hazards[Number(el.dataset.hazardIndex)];
      if(!h)return;
      [["initial",false],["residual",true]].forEach(function(pair){
        const elBadge=$('[data-risk-display="'+pair[0]+'"]',el);
        if(!elBadge)return;
        const n=PDF.score(current,h,pair[1]);
        elBadge.textContent=n==null?"Not assessed":String(n);
        elBadge.className="risk-badge "+PDF.band(n);
      });
    });
  }
  function renderMatrix(){
    $("#matrix-inputs").innerHTML=PDF.likelihoods.map(function(name,i){
      return '<tr><th scope="row">'+esc(name)+'</th>'+PDF.impacts.map(function(_,j){
        const n=current.matrix[i][j];
        return '<td class="'+PDF.band(n)+'"><input type="number" min="1" max="25" inputmode="numeric" aria-label="'+esc(name+" / "+PDF.impacts[j])+
        '" data-matrix-row="'+i+'" data-matrix-col="'+j+'" value="'+esc(n)+'"></td>';
      }).join("")+'</tr>';
    }).join("");
  }
  function repeaterHtml(type,list){
    const types={
      members:[["Full name","name","text"],["Role","role","text"],["Phone number","phone","tel"]],
      harnesses:[["Name / user","user","text"],["Fit for purpose","fit","select"],["Harness tag expiry","expiry","text"]]
    };
    return list.map(function(x,i) {
      const f=types[type].map(function(cfg) {
        const label=cfg[0],key=cfg[1],kind=cfg[2];
        return '<div class="field"><label>'+esc(label)+(kind==="select"?
        '<select data-rep-kind="'+type+'" data-rep-index="'+i+'" data-rep-field="'+key+'">'+optionList(["Yes","No","N/A"],x[key])+'</select>':
        '<input '+(kind==="tel"?'type="tel" ':'')+'data-rep-kind="'+type+'" data-rep-index="'+i+'" data-rep-field="'+key+'" value="'+esc(x[key])+'" />')+'</label></div>';
      }).join("");
      return '<div class="repeater-row '+(type==="harnesses"?"harness":"")+'">'+f+
        '<button class="btn danger" type="button" data-remove-rep="'+type+'" data-remove-index="'+i+'">Remove</button></div>';
    }).join("");
  }
  function renderRepeaters(){
    $("#member-rows").innerHTML=repeaterHtml("members",current.members);
    $("#harness-rows").innerHTML=repeaterHtml("harnesses",current.harnesses);
    renderSignatures();
  }
  function renderSignatures(){
    $("#signature-rows").innerHTML=current.signatures.map(function(s,i){
      return '<div class="entry signature-item" data-signature-index="'+i+'"><div class="entry-head"><h3>Signatory '+(i+1)+'</h3>'+
        '<button class="btn danger" type="button" data-remove-signature="'+i+'">Remove signatory</button></div>'+
        '<div class="signature-inputs"><div class="field"><label>Full name<input data-rep-kind="signatures" data-rep-index="'+i+'" data-rep-field="name" value="'+esc(s.name)+'"></label></div>'+
        '<div class="field"><label>Date signed<input type="date" data-rep-kind="signatures" data-rep-index="'+i+'" data-rep-field="date" value="'+esc(s.date)+'"></label></div></div>'+
        '<div class="field"><label>Signature</label><canvas class="sign-canvas" data-signature-canvas="'+i+'" aria-label="Draw signature for signatory '+(i+1)+'"></canvas>'+
        '<div class="sign-actions"><button type="button" class="btn ghost" data-clear-signature="'+i+'">Clear signature</button>'+
        '<span class="tip">Use a finger, stylus or mouse to sign.</span></div></div></div>';
    }).join("");
    if(step===3)requestAnimationFrame(initSignaturePads);
  }
  function initSignaturePads(){
    $$("[data-signature-canvas]").forEach(function(canvas){
      if(canvas.dataset.ready)return;
      const index=Number(canvas.dataset.signatureCanvas), entry=current.signatures[index];
      if(!entry)return;
      const rect=canvas.getBoundingClientRect();
      if(rect.width<10||rect.height<10)return;
      const factor=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(rect.width*factor);canvas.height=Math.round(rect.height*factor);
      const ctx=canvas.getContext("2d");
      ctx.scale(canvas.width/rect.width,canvas.height/rect.height);
      ctx.lineWidth=2.2;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#292522";
      if(/^data:image\/png;base64,/i.test(entry.image||"")) {
        const image=new Image();image.onload=function(){ctx.drawImage(image,0,0,rect.width,rect.height);};
        image.src=entry.image;
      }
      let drawing=false,moved=false;
      function xy(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
      canvas.addEventListener("pointerdown",function(e){
        e.preventDefault();drawing=true;moved=false;
        try{canvas.setPointerCapture(e.pointerId);}catch(_){}
        const p=xy(e);ctx.beginPath();ctx.moveTo(p.x,p.y);
      });
      canvas.addEventListener("pointermove",function(e){
        if(!drawing)return;e.preventDefault();const p=xy(e);ctx.lineTo(p.x,p.y);ctx.stroke();moved=true;
      });
      function end(e){
        if(!drawing)return;drawing=false;
        if(!moved){const p=xy(e);ctx.beginPath();ctx.arc(p.x,p.y,1.1,0,Math.PI*2);ctx.fill();}
        if(current&&current.signatures[index]){current.signatures[index].image=canvas.toDataURL("image/png");saveSoon();}
      }
      canvas.addEventListener("pointerup",end);
      canvas.addEventListener("pointercancel",end);
      canvas.dataset.ready="1";
    });
  }
  function renderPermit(){
    const img=$("#permit-preview"), clear=$("#clear-permit");
    const valid=/^data:image\/(?:png|jpeg);base64,/i.test(current.permitPhoto||"");
    img.hidden=!valid;clear.hidden=!valid;
    if(valid)img.src=current.permitPhoto;
    else img.removeAttribute("src");
  }
  function showStep(n){
    step=Math.max(0,Math.min(3,n));
    $$("section[data-step]").forEach(function(el){el.hidden=Number(el.dataset.step)!==step;});
    $$("[data-step-tab]").forEach(function(btn){
      if(Number(btn.dataset.stepTab)===step)btn.setAttribute("aria-current","step");
      else btn.removeAttribute("aria-current");
    });
    $("#prev-step").disabled=step===0;
    $("#next-step").hidden=step===3;
    if(step===3)requestAnimationFrame(initSignaturePads);
    window.scrollTo({top:0,behavior:"instant"});
  }
  function edit(r){
    current=normalize(r);
    $("#dashboard").hidden=true;$("#editor").hidden=false;
    $("#form-heading").textContent=current.jobName ? "JSA · "+current.jobName : "JSA risk assessment";
    $$("[data-key]",$("#editor")).forEach(function(el){el.value=current[el.dataset.key]||"";});
    choices($("#ppe-choices"),PPE,current.ppe,"data-list","ppe");
    choices($("#final-check-choices"),FINAL,current.finalChecks,"data-list","finalChecks");
    choices($("#weather-choices"),WEATHER,current.weather,"data-weather","weather");
    renderHazards();renderMatrix();renderRepeaters();renderPermit();
    showStep(0);status("Saved locally");
  }
  function bindFields(){
    $("#editor").addEventListener("input",function(e){
      const el=e.target;
      if(!current||!el||!el.dataset)return;
      if(el.dataset.key) {
        current[el.dataset.key]=el.value;
        if(el.dataset.key==="jobName")$("#form-heading").textContent=current.jobName?"JSA · "+current.jobName:"JSA risk assessment";
        saveSoon();return;
      }
      if(el.dataset.hField){
        const parent=el.closest("[data-hazard-index]"),i=parent&&Number(parent.dataset.hazardIndex);
        if(parent&&current.hazards[i]){
          current.hazards[i][el.dataset.hField]=el.value;
          updateRiskBadges();saveSoon();
        }
        return;
      }
      if(el.dataset.repKind){
        const a=current[el.dataset.repKind],i=Number(el.dataset.repIndex);
        if(Array.isArray(a)&&a[i]){a[i][el.dataset.repField]=el.value;saveSoon();}
        return;
      }
    });
    $("#editor").addEventListener("change",function(e){
      const el=e.target;
      if(!current||!el||!el.dataset)return;
      if(el.dataset.list){
        const key=el.dataset.list;
        const v=el.value,items=current[key]||[];
        current[key]=el.checked?Array.from(new Set(items.concat(v))):items.filter(function(x){return x!==v;});
        saveSoon();return;
      }
      if(el.dataset.weather){
        current.weather=el.value;saveSoon();return;
      }
      if(el.dataset.matrixRow!==undefined) {
        const i=Number(el.dataset.matrixRow),j=Number(el.dataset.matrixCol),v=Number(el.value);
        if(!Number.isInteger(v)||v<1||v>25){
          alert("Matrix scores must be whole numbers from 1 to 25.");
          el.value=current.matrix[i][j];return;
        }
        current.matrix[i][j]=v;el.closest("td").className=PDF.band(v);
        updateRiskBadges();saveSoon();return;
      }
      if(el.dataset.hField && (el.dataset.hField==="initialOverride"||el.dataset.hField==="residualOverride")){
        const i=Number(el.closest("[data-hazard-index]").dataset.hazardIndex);
        const n=el.value.trim();
        if(n!==""&&(!Number.isInteger(Number(n))||Number(n)<1||Number(n)>25)){
          alert("A manual risk score must be a whole number from 1 to 25.");
          el.value="";current.hazards[i][el.dataset.hField]="";
          updateRiskBadges();saveSoon();
        }
      }
    });
  }
  function controlActions(){
    $("#add-hazard").onclick=function(){current.hazards.push(emptyHazard());renderHazards();saveSoon();};
    $("#add-harness").onclick=function(){current.harnesses.push(blankHarness());renderRepeaters();saveSoon();};
    $("#add-member").onclick=function(){current.members.push(blankMember());renderRepeaters();saveSoon();};
    $("#add-signature").onclick=function(){current.signatures.push(blankSign());renderSignatures();saveSoon();};
    $("#reset-matrix").onclick=function(){
      if(!confirm("Restore the risk rating matrix numbers to the reference values?"))return;
      current.matrix=copy(PDF.defaultMatrix);renderMatrix();updateRiskBadges();saveSoon();
    };
    document.addEventListener("click",async function(e){
      const el=e.target&&e.target.closest("button");
      if(!el)return;
      if(el.dataset.openJsa){const r=await get(el.dataset.openJsa);if(r)edit(r);return;}
      if(el.dataset.deleteSaved){
        if(!confirm("Permanently delete this JSA report from this device?"))return;
        await remove(el.dataset.deleteSaved);await dashboard();return;
      }
      if(!current)return;
      if(el.dataset.hazardAction){
        const holder=el.closest("[data-hazard-index]"),i=Number(holder.dataset.hazardIndex);
        const cmd=el.dataset.hazardAction,items=current.hazards;
        if(cmd==="delete"){if(!confirm("Remove this task / hazard?"))return;items.splice(i,1);}
        if(cmd==="duplicate"){const h=copy(items[i]);h.id=uid();h.likelihood="";h.impact="";h.initialOverride="";h.residualLikelihood="";h.residualImpact="";h.residualOverride="";items.splice(i+1,0,h);}
        if(cmd==="up"&&i>0){const h=items.splice(i,1)[0];items.splice(i-1,0,h);}
        if(cmd==="down"&&i<items.length-1){const h=items.splice(i,1)[0];items.splice(i+1,0,h);}
        renderHazards();saveSoon();return;
      }
      if(el.dataset.removeRep){
        const list=current[el.dataset.removeRep],i=Number(el.dataset.removeIndex);
        if(Array.isArray(list))list.splice(i,1);
        renderRepeaters();saveSoon();return;
      }
      if(el.dataset.removeSignature!==undefined){
        current.signatures.splice(Number(el.dataset.removeSignature),1);
        renderSignatures();saveSoon();return;
      }
      if(el.dataset.clearSignature!==undefined){
        const i=Number(el.dataset.clearSignature),canvas=$('[data-signature-canvas="'+i+'"]');
        if(current.signatures[i]){current.signatures[i].image="";if(canvas){canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);}saveSoon();}
      }
    });
  }
  function compressPhoto(file){
    return new Promise(function(resolve,reject){
      if(!file.type.startsWith("image/")){reject(Error("Please select a photo."));return;}
      if(file.size>25*1024*1024){reject(Error("The permit photo must be under 25 MB before compression."));return;}
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){
        try{
          const factor=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));
          const c=document.createElement("canvas");
          c.width=Math.max(1,Math.round(img.naturalWidth*factor));
          c.height=Math.max(1,Math.round(img.naturalHeight*factor));
          c.getContext("2d").drawImage(img,0,0,c.width,c.height);
          URL.revokeObjectURL(url);resolve(c.toDataURL("image/jpeg",.76));
        }catch(e){URL.revokeObjectURL(url);reject(e);}
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(Error("Could not read the permit photo."));};
      img.src=url;
    });
  }
  function bindPermit(){
    $("#permitphoto").addEventListener("change",async function(e){
      const file=e.target.files&&e.target.files[0];
      if(!file||!current)return;
      try{current.permitPhoto=await compressPhoto(file);renderPermit();saveSoon();}
      catch(err){alert("Photo import failed: "+err.message);}
      e.target.value="";
    });
    $("#clear-permit").onclick=function(){
      current.permitPhoto="";renderPermit();saveSoon();
    };
  }
  async function duplicate(){
    if(!current)return;
    const r=copy(current);
    r.id=uid();r.updated=Date.now();r.date=today();r.jobNumber=r.jobNumber?"Copy of "+r.jobNumber:"";
    r.signatures=[blankSign()];r.permitPhoto="";
    r.hazards=(r.hazards||[]).map(function(h){
      h.id=uid();h.likelihood="";h.impact="";h.initialOverride="";
      h.residualLikelihood="";h.residualImpact="";h.residualOverride="";return h;
    });
    r.trainedCompetent="";r.equipmentFit="";r.buddyChecks="";r.electricalTags="";r.workSafe="";r.permitRequired="";
    r.harnesses=(r.harnesses||[]).map(function(h){h.id=uid();h.fit="";return h;});
    await put(r);edit(r);
    alert("JSA copied. Previous signatures, risk ratings and safety check confirmations were cleared for new site verification.");
  }
  function printJsa(){
    if(!current)return;
    if(!current.hazards.length||!current.hazards.some(function(h){return h.task&&h.hazard&&h.mitigation;})){
      if(!confirm("No fully described hazard and mitigation has been entered. Export an incomplete draft PDF anyway?"))return;
    }
    if(!current.signatures.some(function(s){return !!s.image;})){
      if(!confirm("No team signatures are recorded. Export this unsigned JSA draft anyway?"))return;
    }
    $("#pdf").innerHTML=PDF.html(current);
    printingTitle=document.title;
    document.title="ANDRO JSA - "+filename(current.jobName||current.site)+" - "+(current.date||today());
    saveNow();
    window.print();
  }
  function emailDraft(){
    if(!current)return;
    const subject="ANDRO Job Safety Analysis | "+(current.jobName||current.site||"Site")+" | "+(current.jobNumber||"");
    const body="Hello,\n\nPlease find the Job Safety Analysis for "+(current.jobName||current.site||"the site")+
      ", dated "+(current.date||today())+".\n\nIMPORTANT: Please save the JSA as a PDF first and attach it to this email before sending. This form does not automatically email or schedule the JSA.\n\nKind regards,\nANDRO Construction + Projects";
    const extra=String(current.additionalRecipients||"").split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean);
    const recipients=[current.copyEmail].concat(extra).filter(Boolean).join(",");
    if(!confirm("Save your JSA as a PDF first. This opens an email draft but does not attach or send the PDF automatically. Continue?"))return;
    location.href="mailto:"+encodeURIComponent(recipients)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  }
  async function exportBackup(){
    const all=await getAll();
    download(new Blob([JSON.stringify({format:"andro-jsa-v1",exported:new Date().toISOString(),reports:all},null,2)],{type:"application/json"}),
      "ANDRO-JSA-backup-"+today()+".json");
  }
  async function importBackup(file){
    if(!file)return;
    try{
      if(file.size>30*1024*1024)throw Error("Backup too large");
      const data=JSON.parse(await file.text());
      if(data.format!=="andro-jsa-v1"||!Array.isArray(data.reports)||data.reports.length>500)throw Error("This is not an ANDRO JSA backup.");
      if(!confirm("Import "+data.reports.length+" JSA reports? Matching IDs will be overwritten."))return;
      for(const r of data.reports){
        if(!r||typeof r.id!=="string"||!Array.isArray(r.hazards)||!Array.isArray(r.signatures))throw Error("Invalid JSA data in backup.");
        await put(normalize(r));
      }
      await dashboard();alert("JSA backup imported successfully.");
    }catch(e){alert("JSA backup import failed: "+e.message);}
  }
  async function start(){
    bindFields();controlActions();bindPermit();
    $("#new-jsa").onclick=async function(){const r=blank();await put(r);edit(r);};
    $("#back-dashboard").onclick=dashboard;
    $("#prev-step").onclick=function(){showStep(step-1);};
    $("#next-step").onclick=function(){showStep(step+1);};
    $$("[data-step-tab]").forEach(function(el){el.onclick=function(){showStep(Number(el.dataset.stepTab));};});
    $("#save-pdf").onclick=$("#print-jsa-bottom").onclick=printJsa;
    $("#email-jsa").onclick=emailDraft;
    $("#duplicate-jsa").onclick=duplicate;
    $("#delete-jsa").onclick=async function(){
      if(!current||!confirm("Permanently delete this JSA, signatures, and permit photo?"))return;
      clearTimeout(saveTimer);
      const id=current.id;current=null;await remove(id);await dashboard();
    };
    $("#export-jsa-backup").onclick=exportBackup;
    $("#import-jsa-backup").onchange=async function(e){await importBackup(e.target.files&&e.target.files[0]);e.target.value="";};
    window.addEventListener("afterprint",function(){if(printingTitle)document.title=printingTitle;printingTitle="";});
    document.addEventListener("visibilitychange",function(){if(document.hidden&&current)saveNow();});
    window.addEventListener("pagehide",function(){if(current)saveNow();});
    db=await openDB();
    await dashboard();
  }
  start().catch(function(e){
    console.error("JSA editor startup failed:",e);
    $("#saved-jsas").innerHTML="Unable to open local JSA storage: "+esc(e.message)+". Try a normal browser tab and allow storage.";
    alert("The JSA editor could not start. Your existing site reports have not been changed.");
  });
})();
