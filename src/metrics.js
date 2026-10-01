export function compareChannels(actual, wanted, atol = 0) {
  const result = { channels: actual?.length ?? 0, expectedChannels: wanted.length, lengthDelta: [], maxAbsError: 0, rmsError: 0 }
  if (!Array.isArray(actual) || actual.length !== wanted.length) return { ...result, pass: false, reason: 'channel-count' }

  let squared = 0, count = 0
  for (let c = 0; c < wanted.length; c++) {
    result.lengthDelta.push(actual[c].length - wanted[c].length)
    const length = Math.min(actual[c].length, wanted[c].length)
    for (let i = 0; i < length; i++) {
      const error = Math.abs(actual[c][i] - wanted[c][i])
      if (!Number.isFinite(error)) return { ...result, pass: false, reason: 'non-finite' }
      result.maxAbsError = Math.max(result.maxAbsError, error)
      squared += error * error
      count++
    }
  }
  result.rmsError = count ? Math.sqrt(squared / count) : 0
  result.pass = result.lengthDelta.every(delta => delta === 0) && result.maxAbsError <= atol
  if (!result.pass) result.reason = result.lengthDelta.some(delta => delta !== 0) ? 'length' : 'samples'
  return result
}
