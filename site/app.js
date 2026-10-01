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
 if(link?.getAttribute('href')!==location.hash)return
 e.preventDefault();reveal()
})
if(location.hash)reveal()
