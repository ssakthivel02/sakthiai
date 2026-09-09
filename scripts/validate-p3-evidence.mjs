#!/usr/bin/env node
import fs from 'node:fs/promises';
import {validateP3Evidence} from './lib/p3-evidence-validator.mjs';

const file=process.argv[2]||'evidence/funding-readiness/signed-webhook-p3-real-client.json';
try{
  const report=JSON.parse(await fs.readFile(file,'utf8'));
  const result=validateP3Evidence(report);
  process.stdout.write(JSON.stringify({...result,file},null,2)+'\n');
  if(!result.ok)process.exitCode=1;
}catch(error){
  process.stderr.write(JSON.stringify({ok:false,code:'P3_EVIDENCE_READ_FAILED',file,message:String(error?.message||error)},null,2)+'\n');
  process.exitCode=1;
}
