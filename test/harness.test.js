import test from 'node:test'
import assert from 'node:assert/strict'
import reference from '../adapters/reference.js'
import { runSuite } from '../src/harness.js'

test('reference adapter passes every active core case it supports', async () => {
  const run = await runSuite(reference, { tier: 'core' })
  assert.equal(run.summary.fail, 0)
  assert.equal(run.summary.error, 0)
  assert.equal(run.summary.skip, 0)
  assert(run.summary.pass >= 8)
})

test('harness reports source mutation separately', async () => {
  const mutating = {
    id: 'audio',
    async available() { return true },
    async version() { return 'test' },
    supports(test) { return test.workflow?.op === 'clip-reverse' },
    async run(test, input) {
      const sourceAfter = input.map(channel => channel.slice())
      sourceAfter[0][0] += 0.25
      const { start, length } = test.workflow
      return { channels: input.map(channel => channel.slice(start, start + length).reverse()), observations: { sourceAfter } }
    }
  }
  const run = await runSuite(mutating, { tier: 'core', match: 'fragment-isolation' })
  assert.equal(run.summary.fail, 1)
  assert.equal(run.cases[0].metrics.sourceUnchanged, false)
})
