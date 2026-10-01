import { readFile } from 'node:fs/promises'
import { catalog } from './catalog.js'

const read = async name => JSON.parse(await readFile(new URL(`../spec/${name}.json`, import.meta.url), 'utf8'))

export async function loadCases() { const generated=catalog(await read('ecosystem')); const original=(await read('cases')).cases; return [...original.filter(c=>!generated.cases.some(n=>n.id===c.id)),...generated.cases] }
export async function loadFeatures() { const base=await read('features'); const generated=catalog(await read('ecosystem')); return {...base,features:[...base.features.filter(f=>!generated.features.some(n=>n.id===f.id)),...generated.features]} }
export const loadContenders = async () => read('contenders')
export const loadFacets = async () => read('facets')

export async function loadSpec() {
  const [cases, features, contenders, facets] = await Promise.all([loadCases(), loadFeatures(), loadContenders(), loadFacets()])
  return { cases, features, contenders, facets, ecosystem: await read('ecosystem'), competitorInventory: await read('competitors') }
}
