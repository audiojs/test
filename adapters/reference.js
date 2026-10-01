import { defineAdapter } from '../src/adapter.js'
import { expected } from '../src/reference.js'

export default defineAdapter({
  id: 'reference',
  async available() { return true },
  async version() { return '1' },
  supports(test) { return ['exact','exact-with-source','workflow','scalar'].includes(test.oracle.type) },
  async run(test, input) { const result=expected(test,input);if(test.workflow?.op==='stream')result.observations.stream=result.channels;return result }
})
