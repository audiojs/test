const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const finite = Number.isFinite
const number = (value,precision=4) => value === 0 ? '0' : Math.abs(value) < 1e-6 || Math.abs(value) >= 1e6 ? value.toExponential(precision-1) : Number(value.toPrecision(precision)).toLocaleString('en-US', {maximumSignificantDigits:precision})

export function renderMetrics(metrics = []) {
 return `<div class="metric-grid">${metrics.map(metric => {
  const {label,value,unit='',min,max,target,minExclusive=false,maxExclusive=false,status='unknown'}=metric
  const numeric=finite(value), bounds=[min,max,target].filter(finite)
  let precision=4
  while(precision<15&&(numeric&&bounds.some(n=>n!==value&&number(value,precision)===number(n,precision))||finite(min)&&finite(max)&&min!==max&&number(min,precision)===number(max,precision)))precision++
  const tinyRange=finite(min)&&finite(max)&&min!==max&&number(min)===number(max)
  const symmetric=finite(target)&&target>min&&target<max&&Math.abs((target-min)-(max-target))<=Math.max(target-min,max-target)*1e-8
  const interval=tinyRange&&symmetric?`${number(target)} ± ${number(Math.max(target-min,max-target))}`:finite(min)&&finite(max)?`${number(min,precision)} to ${number(max,precision)}`:''
  const allowed=finite(min)&&finite(max)?min===max?number(min):minExclusive||maxExclusive?`${minExclusive?'>':'≥'} ${number(min,precision)}, ${maxExclusive?'<':'≤'} ${number(max,precision)}`:interval:finite(max)?`${maxExclusive?'<':'≤'} ${number(max,precision)}`:finite(min)?`${minExclusive?'>':'≥'} ${number(min,precision)}`:finite(target)?number(target,precision):''
  let chart=''
  if(numeric&&bounds.length&&!(bounds.every(bound=>bound===value))){
   // Divide first to keep the scale finite even near Number.MAX_VALUE.
   const scale=Math.max(...[value,...bounds].map(Math.abs),1e-300)
   let low=Math.min(value/scale,...bounds.map(n=>n/scale)),high=Math.max(value/scale,...bounds.map(n=>n/scale))
   const padding=(high-low||.2)*.12
   low-=padding;high+=padding
   const x=n=>Number((8+(n/scale-low)/(high-low)*184).toFixed(3))
   const bounded=finite(min)||finite(max)
   const start=finite(min)?x(min):!bounded&&finite(target)?x(target):8,end=finite(max)?x(max):!bounded&&finite(target)?x(target):192
   chart=`<svg class="metric-chart" viewBox="0 0 200 24" role="img" aria-label="${esc(`${label}: ${number(value,precision)} ${unit}; ${status==='unknown'?'target':'allowed'} ${allowed} ${unit}`)}"><path class="metric-track" d="M8 12H192"/><path class="metric-band" d="M${start} 12H${end}"/><path class="metric-bound" d="M${start} 7V17M${end} 7V17"/><circle class="metric-point" cx="${x(value)}" cy="12" r="4"/></svg>`
  }
  const formatted=numeric?number(value,precision):typeof value==='string'?value:'—'
  return `<div class="metric ${esc(status)}${typeof value==='string'?' categorical':''}"${numeric?` data-value="${value}"`:''}${finite(min)?` data-min="${min}"`:''}${finite(max)?` data-max="${max}"`:''}><div class="metric-label">${esc(label)}<span class="metric-status" aria-label="${esc(status)}">${status==='pass'?'✓':status==='fail'?'!':'—'}</span></div><div class="metric-value">${esc(formatted)}${unit?` <small>${esc(unit)}</small>`:''}</div>${chart}${allowed?`<div class="metric-limit">${status==='unknown'?'Target':'Allowed'} <strong>${esc(allowed)}${unit?' '+esc(unit):''}</strong></div>`:''}</div>`
 }).join('')}</div>`
}
