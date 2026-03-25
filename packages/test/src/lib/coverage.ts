import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

let require = createRequire(import.meta.url)
let V8ToIstanbul = require('v8-to-istanbul') as any
let { createCoverageMap } =
  require('istanbul-lib-coverage') as typeof import('istanbul-lib-coverage')
let { createContext } = require('istanbul-lib-report') as typeof import('istanbul-lib-report')
let reports = require('istanbul-reports') as typeof import('istanbul-reports')

export interface V8CoverageEntry {
  url: string
  source?: string
  functions: Array<{
    functionName: string
    isBlockCoverage: boolean
    ranges: Array<{ startOffset: number; endOffset: number; count: number }>
  }>
}

export async function generateBrowserCoverageReport(
  entries: V8CoverageEntry[],
  baseUrl: string,
  cwd: string,
  outDir: string,
  testFileUrls: Set<string>,
) {
  let coverageMap = createCoverageMap({})
  let testUrlPrefix = `${baseUrl}/scripts/@test/`
  let converted = 0

  for (let entry of entries) {
    if (!entry.url.startsWith(testUrlPrefix) || !entry.source) continue

    let relativePath = decodeURIComponent(entry.url.slice(testUrlPrefix.length))
    // Strip query strings (e.g. ?t=...)
    let queryIndex = relativePath.indexOf('?')
    if (queryIndex !== -1) relativePath = relativePath.slice(0, queryIndex)

    let scriptPath = `/scripts/@test/${relativePath}`
    if (testFileUrls.has(scriptPath)) continue

    let filePath = path.join(cwd, relativePath)

    try {
      let converter = new V8ToIstanbul(filePath, 0, { source: entry.source })
      await converter.load()
      converter.applyCoverage(entry.functions)
      coverageMap.merge(converter.toIstanbul())
      converted++
    } catch {
      // Skip files that can't be converted (e.g. framework internals bundled in)
    }
  }

  if (converted === 0) {
    console.log('No coverage data collected.')
    return
  }

  await writeIstanbulReports(coverageMap, cwd, outDir)
}

export async function generateServerCoverageReport(
  coverageDataDir: string,
  cwd: string,
  testFiles: Set<string>,
  outDir: string,
) {
  let coverageMap = createCoverageMap({})
  let converted = 0

  let files: string[]
  try {
    files = (await fsp.readdir(coverageDataDir)).filter(
      (f) => f.startsWith('coverage-') && f.endsWith('.json'),
    )
  } catch {
    console.log('No coverage data found.')
    return
  }

  for (let file of files) {
    let data = JSON.parse(await fsp.readFile(path.join(coverageDataDir, file), 'utf-8'))
    let scriptCoverages: Array<{ url: string; functions: any[] }> = data.result ?? []

    for (let entry of scriptCoverages) {
      if (!entry.url.startsWith('file://')) continue

      let filePath: string
      try {
        filePath = fileURLToPath(entry.url)
      } catch {
        continue
      }

      if (!filePath.startsWith(cwd + path.sep)) continue
      if (filePath.includes(`${path.sep}node_modules${path.sep}`)) continue
      if (testFiles.has(filePath)) continue

      try {
        let converter = new V8ToIstanbul(filePath)
        await converter.load()
        converter.applyCoverage(entry.functions)
        coverageMap.merge(converter.toIstanbul())
        converted++
      } catch {
        // Skip files that can't be converted
      }
    }
  }

  // Clean up raw V8 coverage JSON files now that we've processed them
  await Promise.all(files.map((f) => fsp.rm(path.join(coverageDataDir, f), { force: true })))

  if (converted === 0) {
    console.log('No server coverage data collected.')
    return
  }

  await writeIstanbulReports(coverageMap, cwd, outDir)
}

async function writeIstanbulReports(coverageMap: any, cwd: string, outDir: string) {
  await fsp.mkdir(outDir, { recursive: true })
  let ctx = createContext({ coverageMap, dir: outDir, watermarks: undefined } as any)
  console.log('\nCoverage report:')
  reports.create('text').execute(ctx)
  reports.create('lcovonly').execute(ctx)
  console.log(`\nLCOV coverage written to ${path.relative(cwd, path.join(outDir, 'lcov.info'))}`)
}
