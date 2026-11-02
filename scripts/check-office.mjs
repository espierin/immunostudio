import {officeExport,hasOfficeExporter} from './office-export.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.ok(await hasOfficeExporter(),'Inkscape moet beschikbaar zijn');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="#ffffff"/><g transform="translate(30 40)"><text font-family="Calibri" font-size="40" fill="#064986">HLA αβ · Label</text><ellipse cx="230" cy="180" rx="100" ry="70" fill="#FF5A36" stroke="#064986" stroke-width="3"/></g></svg>';
await mkdir('.local/validation',{recursive:true});for(const format of ['emf','wmf']){const bytes=await officeExport(svg,format);if(format==='emf')assert.equal(bytes.readUInt32LE(40),0x464d4520);else assert.ok(bytes.readUInt32LE(0)===0x9ac6cdd7||bytes.readUInt16LE(2)===9);await writeFile('.local/validation/office-text-outlines.'+format,bytes);console.log(`${format.toUpperCase()}: geldige header, ${bytes.length} bytes; alle tekst eerst als vectorcontouren geconverteerd.`)}
