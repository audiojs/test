import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMetrics } from '../src/report-graphics.js'

test('metric charts keep measured values and limits in the same units', () => {
 const html=renderMetrics([{label:'Waveform error',value:.03,max:.0001,unit:'% FS',status:'fail'}])
 assert.match(html,/data-value="0.03" data-max="0.0001"/)
 assert.match(html,/0.03 <small>% FS<\/small>/)
 assert.match(html,/Allowed <strong>≤ 0.0001 % FS/)
 const [start,end]=html.match(/metric-band" d="M([\d.]+) 12H([\d.]+)"/).slice(1).map(Number)
 const point=Number(html.match(/cx="([\d.]+)"/)[1])
 assert(start<end&&point>end,'failure appears beyond the allowed band')
})

test('zero, equal bounds, signed deviations and extreme scales have finite bounded charts', () => {
 for(const metric of [
  {value:-3,min:-2,max:2}, {value:4,min:5},
  {value:1e-300,max:2e-300}, {value:Number.MAX_VALUE,min:-Number.MAX_VALUE,max:0}
 ]){
  const html=renderMetrics([{label:'Measured',...metric}])
  assert.doesNotMatch(html,/NaN|Infinity/)
  assert.match(html,/class="metric-chart"/)
  const point=Number(html.match(/cx="([\d.]+)"/)[1])
  assert(point>=8&&point<=192)
 }
 const exact=renderMetrics([{label:'Error',value:0,max:0}])
 assert.match(exact,/metric-value">0</)
 assert.doesNotMatch(exact,/<svg/,'an exact equality needs no arbitrary axis')
})

test('unknown and categorical measurements never invent chart data; labels are escaped', () => {
 assert.equal(renderMetrics([]),'<div class="metric-grid"></div>')
 for(const value of [undefined,null,NaN,Infinity,'Unchanged']){
  const html=renderMetrics([{label:'<input>',value,max:1}])
  assert.doesNotMatch(html,/<svg|NaN|Infinity|<input>/)
  assert.match(html,/&lt;input&gt;/)
 }
 assert.doesNotMatch(renderMetrics([{label:'Value',value:5}]),/<svg/)
})

test('strict limits and informational targets are labeled without implying a pass', () => {
 const strict=renderMetrics([{label:'Bias',value:.02,min:-.02,max:.02,minExclusive:true,maxExclusive:true,status:'fail'}])
 assert.match(strict,/Allowed <strong>&gt; -0.02, &lt; 0.02/)
 const target=renderMetrics([{label:'Matched clicks',value:9,target:10,status:'unknown'}])
 assert.match(target,/Target <strong>10/)
 assert.doesNotMatch(target,/aria-label="pass"/)
})

test('a target inside a one-sided limit never closes its allowed band', () => {
 for(const metric of [{value:-23,target:-1,max:-.9},{value:23,target:1,min:.9}]){
  const html=renderMetrics([{label:'Level',status:'pass',...metric}])
  const [start,end]=html.match(/metric-band" d="M([\d.]+) 12H([\d.]+)"/).slice(1).map(Number)
  const point=Number(html.match(/cx="([\d.]+)"/)[1])
  assert(start<=point&&point<=end,'a passing measurement sits inside its one-sided allowed band')
 }
})

test('small tolerances remain visible when ordinary rounding would merge the bounds', () => {
 const html=renderMetrics([{label:'Energy',value:299.9999880191375,target:300,min:299.99999,max:300.00001,status:'fail'}])
 assert.match(html,/metric-value">299.999988</)
 assert.match(html,/Allowed <strong>300 ± 0.00001/)
 assert.doesNotMatch(html,/300 to 300/)
 const asymmetric=renderMetrics([{label:'Energy',value:280,target:300,min:299.99999,max:300.00002,status:'fail'}])
 assert.match(asymmetric,/Allowed <strong>299.99999 to 300.00002/)
 assert.doesNotMatch(asymmetric,/±/,'an asymmetric range is not widened into a symmetric one')
})
