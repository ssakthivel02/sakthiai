function gate(env,name){return String(env[name]||'').toLowerCase()==='true';}
function text(value,max=12000){const v=String(value??'').trim();return v&&v.length<=max?v:null;}

export function researchContract(env,input={}){
  if(!gate(env,'RESEARCH_RUNTIME_ENABLED'))return {ok:false,status:503,code:'RESEARCH_RUNTIME_DISABLED',message:'Research execution is disabled. Contract and evidence requirements are ready; no search or model call was attempted.'};
  const query=text(input.query,8000);
  if(!query)return {ok:false,status:400,code:'RESEARCH_QUERY_INVALID'};
  return {ok:true,status:200,plan:{query,mode:'evidence_first',freshness:input.freshness||'auto',requirements:['source_manifest','claim_source_links','searched_at','contradiction_check','uncertainty_notes'],writePolicy:'read_only'}};
}

export function codeContract(env,input={}){
  if(!gate(env,'CODE_RUNTIME_ENABLED'))return {ok:false,status:503,code:'CODE_RUNTIME_DISABLED',message:'Engineering execution is disabled. No repository write, shell command or deployment was attempted.'};
  const objective=text(input.objective,12000);
  if(!objective)return {ok:false,status:400,code:'CODE_OBJECTIVE_INVALID'};
  return {ok:true,status:200,plan:{objective,scope:input.scope||'repository',execution:'sandbox_required',defaultWriteMode:'isolated_branch_only',steps:['inspect','plan','edit','test','verify','prepare_review'],forbidden:['force_push','direct_main_write','secret_exposure','production_deploy_without_approval']}};
}

export function agentContract(env,input={}){
  if(!gate(env,'AGENT_RUNTIME_ENABLED'))return {ok:false,status:503,code:'AGENT_RUNTIME_DISABLED',message:'Agent execution is disabled. No tool or external action was attempted.'};
  const objective=text(input.objective,12000);
  if(!objective)return {ok:false,status:400,code:'AGENT_OBJECTIVE_INVALID'};
  const autonomyClass=['green','amber','red'].includes(input.autonomyClass)?input.autonomyClass:'green';
  return {ok:true,status:200,plan:{objective,autonomyClass,durableStateRequired:true,checkpointing:true,boundedRetries:true,verifierRequired:true,approvalRequired:autonomyClass!=='green',consequentialWrites:'approval_required',states:['planned','queued','running','waiting_approval','paused','completed','failed','cancelled']}};
}

export function knowledgeContract(env,input={}){
  if(!gate(env,'KNOWLEDGE_RUNTIME_ENABLED'))return {ok:false,status:503,code:'KNOWLEDGE_RUNTIME_DISABLED',message:'Knowledge retrieval is disabled. No AI Search, vector query or external retrieval was attempted.'};
  const query=text(input.query,8000);
  if(!query)return {ok:false,status:400,code:'KNOWLEDGE_QUERY_INVALID'};
  return {ok:true,status:200,plan:{query,scope:'tenant_project',requirements:['approved_sources_only','provenance','source_ids','retrieval_timestamp','uncertainty'],aiSearchRequired:true}};
}
