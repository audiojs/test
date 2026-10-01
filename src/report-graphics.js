const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const finite = Number.isFinite
const number = (value,precision=4) => value === 0 ? '0' : Math.abs(value) < 1e-6 || Math.abs(value) >= 1e6 ? value.toExponential(precision-1) : Number(value.toPrecision(precision)).toLocaleString('en-US', {maximumSignificantDigits:precision})

export function renderMetrics(metrics = []) {
 return `<div class="metric-grid">${metrics.map(metric => {
  const {label,value,unit='',min,max,target,minExclusive=false,maxExclusive=false,status='unknown'}=metric
  const numeric=finite(value), bounds=[min,max,target].filter(finite)
  let precision=4
  while(precision<17&&(numeric&&bounds.some(n=>n!==value&&number(value,precision)===number(n,precision))||finite(min)&&finite(max)&&min!==max&&number(min,precision)===number(max,precision)))precision++
  const tinyRange=finite(min)&&finite(max)&&min!==max&&number(min)===number(max)
  const symmetric=finite(target)&&target>min&&target<max&&Math.abs((target-min)-(max-target))<=Math.max(target-min,max-target)*1e-8
  const interval=tinyRange&&symmetric?`${number(target)} ± ${number(Math.max(target-min,max-target))}`:finite(min)&&finite(max)?`${number(min,precision)} to ${number(max,precision)}`:''
  const allowed=finite(min)&&finite(max)?min===max?number(min,precision):minExclusive||maxExclusive?`${minExclusive?'>':'≥'} ${number(min,precision)}, ${maxExclusive?'<':'≤'} ${number(max,precision)}`:interval:finite(max)?`${maxExclusive?'<':'≤'} ${number(max,precision)}`:finite(min)?`${minExclusive?'>':'≥'} ${number(min,precision)}`:finite(target)?number(target,precision):''
  const formatted=numeric?number(value,precision):typeof value==='string'?value:'—'
  return `<div class="metric ${esc(status)}"${numeric?` data-value="${value}"`:''}${finite(min)?` data-min="${min}"`:''}${finite(max)?` data-max="${max}"`:''}><div class="metric-label">${esc(label)}</div><div class="metric-reading"><span class="metric-value">${esc(formatted)}${unit?` <small>${esc(unit)}</small>`:''}</span>${allowed?` <span class="metric-limit">${status==='unknown'?'Target':'Allowed'} <strong>${esc(allowed)}${unit?' '+esc(unit):''}</strong></span>`:''}</div></div>`
 }).join('')}</div>`
}
