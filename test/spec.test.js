import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSpec } from '../src/spec.js'

test('spec ids, references and support claims are internally consistent', async () => {
  const spec = await loadSpec(), features = spec.features.features, cases = spec.cases
  const featureIds = new Set(features.map(feature => feature.id)), sourceIds = new Set(spec.features.sources.map(source => source.id))
  const contenderIds = new Set(spec.contenders.contenders.map(contender => contender.id))
  const support = new Set(Object.keys(spec.features.support))
  assert.equal(featureIds.size, features.length)
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length)
  for (const feature of features) {
    assert(feature.contract)
    assert(feature.sources.every(source => sourceIds.has(source)), `${feature.id}: unknown source`)
    assert(Object.entries(feature.support).every(([id, value]) => contenderIds.has(id) && support.has(value)), `${feature.id}: invalid support`)
    assert(cases.some(item => item.feature === feature.id), `${feature.id}: no test proposed`)
  }
  for (const item of cases) assert(featureIds.has(item.feature), `${item.id}: unknown feature`)
  assert(spec.facets.facets.some(facet => facet.id === 'conformance' && facet.status === 'active'))
  assert(spec.facets.facets.some(facet => facet.id === 'performance'))
  assert(spec.ecosystem.packages.length>=300)
  assert(features.length>=150)
  assert(cases.filter(c=>c.status==='active'&&c.level!=='integrity').length>=400)
})

test('every active case is executable and every planned case names an oracle', async () => {
  const { cases } = await loadSpec()
  for (const item of cases) {
    assert(['active', 'planned'].includes(item.status))
    assert(item.oracle?.type)
    if (item.status === 'active') {
      assert(item.fixture)
      assert(item.steps || item.workflow)
    }
  }
})

test('EBU gating fixtures use the same serialized amplitude on every runtime', async () => {
  const { cases } = await loadSpec()
  const fixture = cases.find(c => c.id === 'analysis.loudness.ebu-5').fixture
  assert.equal(JSON.stringify(fixture.segments.map(s => s.amplitude)), '[0.05011872336272722,0.1,0.05011872336272722]')
  for (const c of cases.filter(c => c.id.startsWith('analysis.loudness.ebu'))) {
    for (const segment of c.fixture.segments || [c.fixture]) {
      const db = 20 * Math.log10(segment.amplitude)
      assert(Math.abs(db - Math.round(db)) < 1e-12, `${c.id}: whole-dB calibration level`)
    }
  }
})
