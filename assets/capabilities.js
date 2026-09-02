window.SAKTHIAI_CAPABILITIES = [
  {id:'chat',icon:'AI',title:'AI Chat & Reasoning',category:'Core Intelligence',status:'FRONTEND_READY',description:'Multi-step reasoning, structured answers, model routing and transparent limitations.',prompt:'Analyse a complex problem, compare options, challenge assumptions and produce an evidence-aware action plan.'},
  {id:'research',icon:'R',title:'Deep Research',category:'Core Intelligence',status:'RUNTIME_REQUIRED',description:'Fresh web research, evidence comparison, citation manifests and contradiction handling.',prompt:'Research this topic deeply, separate facts from claims, compare sources and give me a decision-grade conclusion.'},
  {id:'code',icon:'</>',title:'Code & Engineering',category:'Build',status:'RUNTIME_REQUIRED',description:'Repository-aware planning, coding, tests, review, debugging and engineering artifacts.',prompt:'Inspect the codebase, identify the real root cause, implement the smallest robust fix and prove it with tests.'},
  {id:'agents',icon:'A',title:'Agents & Orchestration',category:'Operate',status:'BUILDING',description:'Durable plans, bounded workers, checkpoints, verifier loops and approval-gated execution.',prompt:'Turn this objective into a resumable task graph with clear workers, checkpoints, evidence and approval gates.'},
  {id:'automation',icon:'⌁',title:'Automation Hub',category:'Operate',status:'BUILDING',description:'Scheduled, conditional and event-driven workflows with clear stop controls and auditability.',prompt:'Design an automation that runs only when needed, records evidence, avoids duplicate work and stops safely.'},
  {id:'webapp',icon:'◫',title:'Website & App Builder',category:'Build',status:'BUILDING',description:'Product architecture, UI generation, code, testing, packaging and deployment-ready source.',prompt:'Build a production-quality responsive application from this product brief with truthful states and complete QA gates.'},
  {id:'image',icon:'◈',title:'Image Studio',category:'Create',status:'ENGINE_REQUIRED',description:'Image generation, editing, variations, brand systems and production asset workflows.',prompt:'Create a premium visual concept with exact composition, accessibility and reusable production variants.'},
  {id:'video',icon:'▶',title:'Video & Avatar Studio',category:'Create',status:'ENGINE_REQUIRED',description:'Video, avatar, storyboard, lipsync, editing and scene workflows behind replaceable engines.',prompt:'Turn this concept into a complete video workflow with scenes, voice, captions, rights metadata and export targets.'},
  {id:'voice',icon:'≈',title:'Voice, STT & Dubbing',category:'Create',status:'ENGINE_REQUIRED',description:'Speech recognition, TTS, voice workflows, translation, dubbing and audio processing.',prompt:'Transcribe, translate and produce a natural multilingual voice workflow while preserving speaker intent.'},
  {id:'artifacts',icon:'▤',title:'Docs, Slides & Sheets',category:'Productivity',status:'BUILDING',description:'Editable documents, PDFs, presentations, spreadsheets and structured reusable artifacts.',prompt:'Convert this raw material into a polished editable deliverable with clear structure, evidence and professional formatting.'},
  {id:'knowledge',icon:'K',title:'Knowledge & RAG',category:'Knowledge',status:'RUNTIME_REQUIRED',description:'Private ingestion, retrieval, provenance, approved memory and knowledge graph foundations.',prompt:'Use only approved evidence, retrieve the most relevant context, show provenance and identify uncertainty.'},
  {id:'developer',icon:'{ }',title:'Developer Platform',category:'Build',status:'BUILDING',description:'APIs, SDKs, runtime registry, observability, evals, connectors and provider-neutral engine contracts.',prompt:'Design the API and runtime contract so engines remain replaceable, observable, testable and cost controlled.'}
];

window.SAKTHIAI_RUNTIME_POLICY = Object.freeze({
  paidProvidersEnabled:false,
  silentPaidFallback:false,
  legacyRuntimeImport:false,
  externalWritesDefault:'approval_required',
  secretStorageInBrowser:false,
  runtimeTruthRequired:true,
  costMode:'free_first_fail_closed'
});
