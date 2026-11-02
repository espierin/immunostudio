import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=process.argv[2]||'C:/Users/espierin/Nextcloud/Presentations/Basis_set_2026';
const index=JSON.parse(await readFile('public/library/index.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const item of index){const sourceBytes=await readFile(path.join(source,item.file)),appBytes=await readFile(path.join('public/library',item.file));if(hash(sourceBytes)!==hash(appBytes))throw Error('Appkopie wijkt af: '+item.file)}
console.log(`${index.length} SVG-kopieën komen byte voor byte overeen met de actuele broncollectie.`);
