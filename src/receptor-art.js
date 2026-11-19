// Original schematic topology, not an atomic structure or a binding model.
export function ccr5Artwork(){
  const helices=Array.from({length:7},(_,i)=>{
    const x=66+i*17;
    return `<g data-ccr5-helix="${i+1}"><rect x="${x}" y="30" width="11" height="62" rx="5.5" fill="#A9C6E2" stroke="#064986" stroke-width="1.6"/>${Array.from({length:4},(_,j)=>`<path d="M${x+2} ${41+j*11}q8 -4 7 -8" fill="none" stroke="#F3F8FC" stroke-width="3"/>`).join('')}</g>`;
  }).join('');
  return `<g data-receptor="CCR5" stroke="#064986" stroke-linecap="round" stroke-linejoin="round"><g fill="none" stroke-width="3.5"><path d="M71.5 30C72 22 56 17 57 23"/><path d="M71.5 92C73 110 88.5 109 88.5 92"/><path d="M88.5 30C90 13 105.5 13 105.5 30"/><path d="M105.5 92C106 109 122.5 109 122.5 92"/><path d="M122.5 30C121 9 139.5 8 139.5 30"/><path d="M139.5 92C139 110 156.5 110 156.5 92"/><path d="M156.5 30C158 13 173.5 13 173.5 30"/><path d="M173.5 92C174 103 182 105 187 100"/></g>${helices}<circle cx="57" cy="23" r="2.8" fill="#FF6B35" stroke="none"/><circle cx="187" cy="100" r="2.8" fill="#064986" stroke="none"/></g>`;
}
export function ccr5SVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280" viewBox="0 0 240 140"><title>CCR5 chemokine receptor (CD195)</title><desc>Editable schematic of the seven transmembrane helices and connecting loops of CCR5. Orange marks the extracellular N terminus; blue marks the intracellular C terminus. Not an atomic structure. Reference: UniProt P51681, https://www.uniprot.org/uniprotkb/P51681/entry.</desc>${ccr5Artwork()}<text x="120" y="130" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#064986">CCR5</text></svg>`;
}
