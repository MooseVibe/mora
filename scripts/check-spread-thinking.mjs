import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../src/app/api/prototypes/spread-reading/route.ts', import.meta.url), 'utf8')
const generationConfig = route.slice(route.indexOf('generationConfig:'), route.indexOf('signal: AbortSignal.timeout'))

assert.match(generationConfig, /thinkingConfig:\s*\{ thinkingLevel: 'low' \}/)
assert.match(generationConfig, /responseMimeType:\s*'application\/json'/)
assert.match(generationConfig, /responseJsonSchema:\s*schema/)
assert.match(route, /models\/gemini-3\.5-flash:generateContent/)

console.log('Gemini spread keeps the model and JSON schema with low thinking enabled.')
