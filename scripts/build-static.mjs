import fs from 'node:fs';
import path from 'node:path';

const out='dist';
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','manifest.webmanifest','offline.html','sw.js']){
  fs.copyFileSync(file,path.join(out,file));
}
fs.cpSync('assets',path.join(out,'assets'),{recursive:true});

const forbidden=['src','config','migrations','scripts','.github','wrangler.jsonc','README.md','package.json'];
for(const name of forbidden){
  if(fs.existsSync(path.join(out,name)))throw new Error(`Unsafe deployment asset leaked into dist: ${name}`);
}
console.log('SAKTHIAI_STATIC_DIST_READY');
