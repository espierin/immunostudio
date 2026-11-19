const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export function figureLabelMarkup(item, labelsVisible = true, color = '#064986') {
  if (!labelsVisible || !item.figureLabelVisible || !item.figureLabel?.trim()) return '';
  const size = Math.max(5, Math.min(120, Number(item.figureLabelSize) || 18));
  const y = item.h * Math.max(0, Math.min(1, Number(item.figureLabelY ?? .96)));
  return `<text data-figure-label="true" x="${item.w / 2}" y="${y}" text-anchor="middle" textLength="${Math.min(item.w * .94, item.figureLabel.length * size * .58)}" lengthAdjust="spacingAndGlyphs" font-family="Calibri,Arial,sans-serif" font-size="${size}" fill="${escape(color)}">${escape(item.figureLabel)}</text>`;
}

export function figureLabelBounds(item) {
  if (item.kind !== 'svg' || !item.figureLabelVisible || !item.figureLabel?.trim()) return null;
  const size=Math.max(5,Math.min(120,Number(item.figureLabelSize)||18));
  const baseline=item.h*Math.max(0,Math.min(1,Number(item.figureLabelY??.96)));
  const localY=baseline-size*.35;
  const dy=(item.mirrorY?item.h-localY:localY)-item.h/2;
  const angle=(item.rotation||0)*Math.PI/180,h=size*1.3;
  return {x:item.x-dy*Math.sin(angle),y:item.y+item.h/2+dy*Math.cos(angle)-h/2,w:item.w,h,rotation:item.rotation||0};
}

export function figureLabelControls(item) {
  if (item.kind !== 'svg') return '';
  return `<div class="hinge-box"><strong>Figuurlabel</strong><label class="check"><input type="checkbox" data-sheet-field="figureLabelVisible" ${item.figureLabelVisible ? 'checked' : ''}> Tekstlabel tonen</label><label>Labeltekst<input data-no-translate maxlength="512" data-sheet-field="figureLabel" value="${escape(item.figureLabel || '')}"></label><label>Labelgrootte<input type="number" min="5" max="120" data-sheet-field="figureLabelSize" value="${item.figureLabelSize || 18}"></label><label>Labelpositie<input title="0 is bovenaan, 1 is onderaan de figuur" type="number" min="0" max="1" step=".05" data-sheet-field="figureLabelY" value="${item.figureLabelY ?? .96}"></label></div>`;
}
