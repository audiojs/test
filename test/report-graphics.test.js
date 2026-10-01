import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMetrics } from '../src/report-graphics.js'

test('metric rows keep measured values and limits in the same units', () => {
 const html=renderMetrics([{label:'Waveform error',value:.03,max:.0001,unit:'% FS',status:'fail'}])
 assert.match(html,/data-value="0.03" data-max="0.0001"/)
 assert.match(html,/0.03 <small>% FS<\/small>/)
 assert.match(html,/Allowed <strong>≤ 0.0001 % FS/)
 assert.doesNotMatch(html,/<svg|metric-status/)
})

test('zero, equal bounds, signed deviations and extreme scales keep their values', () => {
 for(const metric of [
  {value:-3,min:-2,max:2}, {value:4,min:5},
  {value:1e-300,max:2e-300}, {value:Number.MAX_VALUE,min:-Number.MAX_VALUE,max:0}
 ]){
  const html=renderMetrics([{label:'Measured',...metric}])
  assert.doesNotMatch(html,/NaN|Infinity/)
  assert(html.includes(`data-value="${metric.value}"`))
  for(const bound of ['min','max'])if(bound in metric)assert(html.includes(`data-${bound}="${metric[bound]}"`))
 }
 const exact=renderMetrics([{label:'Error',value:0,max:0,status:'pass'}])
 assert.match(exact,/metric-value">0</)
 assert.match(exact,/Allowed <strong>≤ 0</)
})

test('unknown measurements remain unknown and categorical labels are escaped', () => {
 assert.equal(renderMetrics([]),'<div class="metric-grid"></div>')
 for(const value of [undefined,null,NaN,Infinity]){
  const html=renderMetrics([{label:'<input>',value,max:1}])
  assert.doesNotMatch(html,/data-value|NaN|Infinity|<input>/)
  assert.match(html,/metric-value">—</)
  assert.match(html,/&lt;input&gt;/)
 }
 const category=renderMetrics([{label:'Original audio',value:'<Unchanged>'}])
 assert.match(category,/&lt;Unchanged&gt;/)
 assert.doesNotMatch(category,/data-value|metric-limit/)
})

test('strict limits and informational targets remain distinct', () => {
 const strict=renderMetrics([{label:'Bias',value:.02,min:-.02,max:.02,minExclusive:true,maxExclusive:true,status:'fail'}])
 assert.match(strict,/Allowed <strong>&gt; -0.02, &lt; 0.02/)
 const target=renderMetrics([{label:'Matched clicks',value:9,target:10,status:'unknown'}])
 assert.match(target,/Target <strong>10/)
 assert.doesNotMatch(target,/class="metric pass"/)
})

test('targets inside one-sided limits do not replace the required bound', () => {
 const upper=renderMetrics([{label:'Level',value:-23,target:-1,max:-.9,status:'pass'}])
 assert.match(upper,/Allowed <strong>≤ -0.9/)
 assert.doesNotMatch(upper,/Target/)
 const lower=renderMetrics([{label:'Level',value:23,target:1,min:.9,status:'pass'}])
 assert.match(lower,/Allowed <strong>≥ 0.9/)
 assert.doesNotMatch(lower,/Target/)
})

test('small tolerances remain visible when ordinary rounding would merge the bounds', () => {
 const html=renderMetrics([{label:'Energy',value:299.9999880191375,target:300,min:299.99999,max:300.00001,status:'fail'}])
 assert.match(html,/metric-value">299.999988</)
 assert.match(html,/Allowed <strong>300 ± 0.00001/)
 assert.doesNotMatch(html,/300 to 300/)
 const asymmetric=renderMetrics([{label:'Energy',value:280,target:300,min:299.99999,max:300.00002,status:'fail'}])
 assert.match(asymmetric,/Allowed <strong>299.99999 to 300.00002/)
 assert.doesNotMatch(asymmetric,/±/,'an asymmetric range is not widened into a symmetric one')
 const exact=renderMetrics([{label:'Energy',value:300,min:299.999999,max:299.999999,status:'fail'}])
 assert.match(exact,/metric-value">300</)
 assert.match(exact,/Allowed <strong>299.999999</,'an exact required value uses the same precision as the measurement')
 const adjacent=renderMetrics([{label:'Value',value:1+Number.EPSILON,max:1,status:'fail'}])
 assert.match(adjacent,/metric-value">1.0000000000000002</,'distinct floating-point values never round into a false match')
})
