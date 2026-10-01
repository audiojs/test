function inflate(container) {
 for(const source of container.querySelectorAll('script.visual-template')){
  const template=document.createElement('template')
  template.innerHTML=source.textContent
  source.replaceWith(template.content)
 }
 return container
}
document.addEventListener('toggle',e=>{
 if(e.target.matches('.case-result[open], .bench-result[open]'))inflate(e.target)
},true)

function reveal() {
 let id
 try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
 const el=document.getElementById(id)
 if(!el)return
 for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true
 const target=el.tagName==='DETAILS'?el.querySelector('summary'):el
 target?.focus({preventScroll:true})
 el.scrollIntoView({block:'start'})
}
window.addEventListener('hashchange',reveal)
document.addEventListener('click',e=>{
 if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return
 const link=e.target.closest('a[href^="#"]')
 if(link?.dataset.popover&&typeof popover?.showPopover==='function')return
 if(link?.getAttribute('href')!==location.hash)return
 e.preventDefault();reveal()
})
if(location.hash)reveal()

const popover=document.getElementById('cell-popover')
if(popover&&typeof popover.showPopover==='function'){
 const body=popover.querySelector('.popover-body'),heading=popover.querySelector('h3'),closeButton=popover.querySelector('button')
 let active,pressed
 const element=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
 const close=(focus=false)=>{
  if(popover.matches(':popover-open'))popover.hidePopover()
  if(focus)active?.focus({preventScroll:true})
 }
 function content(trigger){
  const cell=trigger.closest('td'),row=cell.parentElement,table=cell.closest('table')
  const column=[...table.tHead.querySelectorAll('[data-tool]')].find(th=>th.dataset.tool===cell.dataset.tool)
  const label=row.querySelector('th').cloneNode(true),clip=label.querySelector('small')
  const clipText=clip?.textContent;clip?.remove()
  heading.textContent=label.textContent.trim()
  popover.querySelector('.popover-tool').textContent=column.querySelector('a').textContent
  body.replaceChildren()
  const source=document.getElementById(trigger.hash.slice(1))
  if(trigger.dataset.popover==='speed'){
   const context=[clipText,column.querySelector('.environment')?.textContent].filter(Boolean).join(', ')
   if(context)body.append(element('div',context,'speed-clip'))
   const output=source?.querySelector('.bench-output')
   if(output){
    const evidence=inflate(output.cloneNode(true))
    for(const detail of evidence.querySelectorAll('details'))detail.open=false
    body.append(evidence)
   }else body.append(element('div','No timing recorded','case-state'))
   return
  }
  const totals=(trigger.dataset.counts||'0,0,0,0').split(',').map(Number)
  const overview=element('div','','result-summary')
  const states=['pass','fail','error','skip'],names=['passed','failed','errors','not run']
  totals.forEach((count,i)=>{
   if(!count)return
   const stat=element('span',`${count} ${i===2&&count===1?'error':names[i]}`,states[i]);stat.dataset.status=states[i];stat.dataset.count=count
   if(overview.childNodes.length)overview.append(', ')
   overview.append(stat)
  })
  body.append(overview)
  if(row.dataset.scope==='integrity')body.append(element('div','Basic checks: valid output, input intact','scope-label'))
  const contract=source?.querySelector(':scope > p')
  const cases=[...source?.querySelectorAll('.case-result')||[]].map(test=>({test,output:[...test.querySelectorAll('.case-output')].find(out=>out.dataset.tool===cell.dataset.tool)})).filter(item=>item.output)
  const failed=status=>status==='fail'||status==='error'
  cases.sort((a,b)=>Number(failed(b.output.dataset.status))-Number(failed(a.output.dataset.status)))
  for(const {test,output} of cases){
   const status=output.dataset.status,detail=document.createElement('details'),summary=element('summary','')
   detail.className='popover-case';detail.name='popover-cases'
   summary.append(element('span',test.dataset.title||'Recorded test','case-label'),element('span',({pass:'✓',fail:'!',error:'Error',skip:'Not run'})[status]||status,`case-status ${status}`))
   const evidence=inflate(output.cloneNode(true))
   summary.querySelector('.case-status').setAttribute('aria-label',status)
   const context=evidence.querySelector('.case-context')
   if(context)summary.querySelector('.case-label').append(context)
   evidence.querySelector('.case-tool')?.remove()
   for(const raw of evidence.querySelectorAll('details'))raw.open=false
   const definition=test.querySelector(':scope > .technical-details > pre')
   if(definition)evidence.querySelector('.technical-details')?.append(element('p','Test definition'),definition.cloneNode(true))
   detail.append(summary)
   detail.append(evidence)
   body.append(detail)
  }
  if(!cases.length&&!totals.some(Boolean))body.append(element('div','No results recorded','case-state'))
  if(contract){
   const definition=document.createElement('details')
   definition.className='technical-details'
   definition.append(element('summary','Test definition'),element('p',contract.textContent))
   body.append(definition)
  }
 }
 function position(trigger){
  const rect=trigger.closest('td').getBoundingClientRect(),gap=8,edge=12
  const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight
  const below=height-rect.bottom-gap-edge,above=rect.top-gap-edge,down=below>=Math.min(480,above)
  popover.style.maxHeight=`${Math.min(480,height-2*edge,Math.max(64,down?below:above))}px`
  const box=popover.getBoundingClientRect()
  popover.style.left=`${Math.max(edge,Math.min(width-box.width-edge,rect.left+(rect.width-box.width)/2))}px`
  popover.style.top=`${Math.max(edge,Math.min(height-box.height-edge,down?rect.bottom+gap:rect.top-box.height-gap))}px`
 }
 function open(trigger){
  if(active===trigger&&(popover.matches(':popover-open')||pressed===trigger)){close(true);return}
  close()
  active=trigger;content(trigger)
  active.setAttribute('aria-expanded','true')
  popover.showPopover({source:trigger})
  position(trigger);body.scrollTop=0
  closeButton.focus({preventScroll:true})
 }
 for(const trigger of document.querySelectorAll('.result[data-popover]')){
  trigger.setAttribute('role','button')
  trigger.setAttribute('aria-haspopup','dialog')
  trigger.setAttribute('aria-controls',popover.id)
  trigger.setAttribute('aria-expanded','false')
 }
 // Remember a press on the active cell before native light-dismiss runs.
 document.addEventListener('pointerdown',e=>{pressed=popover.matches(':popover-open')&&e.target.closest('td')===active?.closest('td')?active:null},true)
 document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return
  const trigger=e.target.closest('td')?.querySelector('.result[data-popover]')
  if(!trigger)return
  e.preventDefault();open(trigger);pressed=null
 })
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&popover.matches(':popover-open')){e.preventDefault();close(true)}
  if(e.key===' '&&e.target.matches('.result[data-popover]')){e.preventDefault();e.target.click()}
 })
 popover.addEventListener('beforetoggle',e=>{if(e.newState==='closed')active?.setAttribute('aria-expanded','false')})
 popover.addEventListener('toggle',()=>{if(popover.matches(':popover-open'))position(active)},true)
 closeButton.addEventListener('click',()=>close(true))
 document.addEventListener('scroll',e=>{if(!popover.contains(e.target))close()},true)
 window.addEventListener('resize',()=>close())
}
