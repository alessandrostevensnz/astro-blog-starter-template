/** ANDRO Construction V3 -- add as a NEW Apps Script file in ANDRO NEW FINAL.
 * Do not overwrite the existing Code.gs or change its trigger/properties.
 * Uses the existing ANDRO_SYNC_SECRET, never displays it. V3 has its own trigger,
 * log and enable switch. Run androV3Check first; it cannot create an entry.
 */
const ANDRO_V3_CFG = Object.freeze({
  sheet:'Facebook Leads V3', log:'ANDRO V3 Sync Log', form:'2055955115103853',
  test:'2345261342938853', url:'https://andro.co.nz/api/win/meta/sheets',
  work:'what_would_you_use_your_8_hours_of_construction_labour_for?',
  future:'are_you_planning_any_larger_renovations,_extensions_or_outdoor_projects_in_the_next_12_months?',
  marketing:"yes!_let_me_know_when_the_next_opportunity_to_win_or_save_money_on_my_property_comes_around._i'd_hate_to_miss_out_on_exclusive_offers_from_andro_by_email._i_can_unsubscribe_at_any_time.",
  terms:"i_confirm_i_am_18_or_older,_have_permission_to_arrange_work_at_an_eligible_mainland_auckland_property,_and_agree_to_andro's_giveaway_terms_and_privacy_notice."
});
function androV3Normalize_(v){return String(v==null?'':v).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function androV3True_(v){return ['true','yes','1','agreed','i_agree'].includes(androV3Normalize_(v));}
function androV3Grid_(){
  const book=SpreadsheetApp.getActiveSpreadsheet(), sheet=book.getSheetByName(ANDRO_V3_CFG.sheet);
  if(!sheet)throw Error('Facebook Leads V3 tab not found');
  const grid=sheet.getDataRange().getDisplayValues(), heads=(grid[0]||[]).map(androV3Normalize_);
  const keys=['id','created_time','form_id','email','full_name','phone_number',ANDRO_V3_CFG.work,ANDRO_V3_CFG.future,ANDRO_V3_CFG.marketing,ANDRO_V3_CFG.terms];
  for(const k of keys){if(heads.filter(h=>h===androV3Normalize_(k)).length!==1)throw Error('Missing or ambiguous V3 column: '+k);}
  const read=(row,k)=>String(row[heads.indexOf(androV3Normalize_(k))]||'').trim();
  return {book,rows:grid.slice(1),read};
}
function androV3Send_(lead){
  const secret=PropertiesService.getScriptProperties().getProperty('ANDRO_SYNC_SECRET');
  if(!secret||secret.length<32)throw Error('Existing ANDRO_SYNC_SECRET missing or too short');
  const body=JSON.stringify({source:'meta_google_sheets',sent_at:new Date().toISOString(),lead});
  const sig=Utilities.computeHmacSha256Signature(body,secret,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  const r=UrlFetchApp.fetch(ANDRO_V3_CFG.url,{method:'post',contentType:'application/json; charset=utf-8',headers:{'X-ANDRO-Sheets-Signature':'sha256='+sig},payload:body,followRedirects:false,muteHttpExceptions:true});
  let data={};try{data=JSON.parse(r.getContentText());}catch(_){}
  return {status:r.getResponseCode(),data};
}
function androV3Check(){
  const {rows,read}=androV3Grid_();
  const found=rows.filter(r=>read(r,'id').replace(/^l:/i,'')===ANDRO_V3_CFG.test);
  if(found.length!==1)throw Error('Expected exactly one known V3 test row');
  const r=found[0], form=read(r,'form_id').replace(/^f:/i,'');
  if(form!==ANDRO_V3_CFG.form)throw Error('Unexpected form ID');
  if(!androV3True_(read(r,ANDRO_V3_CFG.terms)))throw Error('Required terms response not affirmative');
  if(!androV3True_(read(r,ANDRO_V3_CFG.marketing)))throw Error('Test marketing response not affirmative');
  const result=androV3Send_({id:ANDRO_V3_CFG.test,form_id:form,created_time:read(r,'created_time'),terms_accepted:false});
  if(result.status!==422||result.data.error!=='terms_acknowledgement_not_captured')throw Error('V3 connection not ready (HTTP '+result.status+'): '+String(result.data.error||'unexpected response'));
  Logger.log('V3 CHECK PASSED: all question columns found, both test consents recognised, signed backend verified. No entry created.');
}
function androV3Sync(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('ANDRO_V3_ENABLED')!=='true'){Logger.log('V3 sync disabled.');return;}
  const lock=LockService.getScriptLock();if(!lock.tryLock(10000))return;
  try{
    const {book,rows,read}=androV3Grid_();
    let log=book.getSheetByName(ANDRO_V3_CFG.log);
    if(!log){log=book.insertSheet(ANDRO_V3_CFG.log);log.appendRow(['lead_id','status','processed_at']);}
    const seen=new Set(log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,1).getDisplayValues().flat().map(x=>String(x).replace(/^l:/i,'')):[]);
    let count=0;
    for(const r of rows){
      if(count>=50)break;
      const id=read(r,'id').replace(/^l:/i,''),form=read(r,'form_id').replace(/^f:/i,'');
      if(!/^\d{5,25}$/.test(id)||seen.has(id)||form!==ANDRO_V3_CFG.form)continue;
      const finish=status=>{log.appendRow(['l:'+id,status,new Date().toISOString()]);seen.add(id);};
      if(id===ANDRO_V3_CFG.test||/^test@meta\.com$/i.test(read(r,'email'))||/<test lead:/i.test(read(r,'full_name'))){finish('skipped_test');continue;}
      if(!androV3True_(read(r,ANDRO_V3_CFG.terms))){Logger.log('V3 row lacks terms agreement; not imported.');continue;}
      const reply=androV3Send_({id,form_id:form,created_time:read(r,'created_time'),full_name:read(r,'full_name'),email:read(r,'email'),phone_number:read(r,'phone_number').replace(/^p:/i,'').trim(),terms_accepted:true,marketing_consent:androV3True_(read(r,ANDRO_V3_CFG.marketing)),construction_work:read(r,ANDRO_V3_CFG.work),future_project:read(r,ANDRO_V3_CFG.future)});
      if(reply.status!==200||!['accepted','duplicate','already_seen'].includes(reply.data.status)){Logger.log('V3 import stopped (HTTP %s); row not marked processed.',reply.status);return;}
      finish(reply.data.status);count++;
    }
    Logger.log('V3 sync: %s confirmed rows.',count);
  }finally{lock.releaseLock();}
}
function androV3Activate(){
  // Run only after V3 terms/privacy and both opt-in / opt-out tests are verified.
  androV3Check();
  PropertiesService.getScriptProperties().setProperty('ANDRO_V3_ENABLED','true');
  for(const t of ScriptApp.getProjectTriggers())if(t.getHandlerFunction()==='androV3Sync')ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('androV3Sync').timeBased().everyMinutes(5).create();
  androV3Sync();
}
