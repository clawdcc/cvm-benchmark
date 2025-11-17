#!/usr/bin/env node
/**
 * Generate HTML Report Comparing --version vs Interactive Startup Benchmarks
 *
 * Loads both benchmark types and creates overlay charts matching PERFORMANCE_REPORT_3RUN.html format
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Generate HTML report comparing --version and interactive startup benchmarks
 */
function generate() {
  console.log('📊 Generating Startup Benchmark Comparison Report...\n');

  // Load --version benchmarks
  const versionBenchFile = path.join(os.homedir(), '.cvm', 'benchmarks-all-3run.json');
  let versionResults = [];

  if (fs.existsSync(versionBenchFile)) {
    const versionData = JSON.parse(fs.readFileSync(versionBenchFile, 'utf-8'));
    versionResults = versionData.results;
    console.log(`✅ Loaded ${versionResults.length} --version benchmarks`);
  } else {
    console.log('⚠️  No --version benchmarks found');
  }
  
  // Load interactive startup benchmarks
  const startupFiles = fs.readdirSync('.').filter(f => f.match(/^benchmark-startup-.*\.json$/));
  const startupResults = [];
  
  startupFiles.forEach(file => {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const version = data.data.version;
  
    // Calculate average and stats from results
    const times = data.data.results.map(r => r.time);
    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
  
    // Calculate standard deviation
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
    const stdDev = Math.round(Math.sqrt(variance));
  
    startupResults.push({
      version,
      timestamp: data.timestamp,
      runs: times,
      avgTime,
      minTime,
      maxTime,
      stdDev,
      result: data.data.results[0].result,
    });
  });
  
  console.log(`✅ Loaded ${startupResults.length} interactive startup benchmarks\n`);
  
  if (versionResults.length === 0 && startupResults.length === 0) {
    console.error('❌ No benchmark data found');
    console.log('Run benchmarks first:\n');
    console.log('  - Version: npm run benchmark:all');
    console.log('  - Startup: node benchmark-startup.js <version>\n');
    process.exit(1);
  }
  
  // Merge both datasets by version
  const allVersions = [...new Set([
    ...versionResults.map(r => r.version),
    ...startupResults.map(r => r.version)
  ])].sort((a, b) => {
    // Sort by version number
    const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
    if (aMajor !== bMajor) return aMajor - bMajor;
    if (aMinor !== bMinor) return aMinor - bMinor;
    return aPatch - bPatch;
  });
  
  // Build merged data
  const mergedData = allVersions.map(version => {
    const vData = versionResults.find(r => r.version === version);
    const sData = startupResults.find(r => r.version === version);
  
    return {
      version,
      versionTime: vData ? vData.avgTime : null,
      versionRuns: vData ? vData.runs : null,
      versionStdDev: vData ? vData.stdDev : null,
      startupTime: sData ? sData.avgTime : null,
      startupRuns: sData ? sData.runs : null,
      startupStdDev: sData ? sData.stdDev : null,
      startupResult: sData ? sData.result : null,
    };
  });
  
  console.log(`📈 Merged ${mergedData.length} versions\n`);
  console.log('Generating HTML report...');
  
  // Calculate stats
  const versionStats = {
    count: versionResults.length,
    avg: Math.round(versionResults.reduce((a, r) => a + r.avgTime, 0) / versionResults.length),
    min: Math.min(...versionResults.map(r => r.avgTime)),
    max: Math.max(...versionResults.map(r => r.avgTime)),
    fastest: versionResults.reduce((a, b) => a.avgTime < b.avgTime ? a : b),
    slowest: versionResults.reduce((a, b) => a.avgTime > b.avgTime ? a : b),
  };
  
  const startupStats = startupResults.length > 0 ? {
    count: startupResults.length,
    avg: Math.round(startupResults.reduce((a, r) => a + r.avgTime, 0) / startupResults.length),
    min: Math.min(...startupResults.map(r => r.avgTime)),
    max: Math.max(...startupResults.map(r => r.avgTime)),
    fastest: startupResults.reduce((a, b) => a.avgTime < b.avgTime ? a : b),
    slowest: startupResults.reduce((a, b) => a.avgTime > b.avgTime ? a : b),
  } : null;
  
  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CVM Startup Analysis - Comparison</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
  
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #1a1a1a;
              color: #e0e0e0;
              line-height: 1.6;
          }
  
          .container {
              max-width: 1400px;
              margin: 0 auto;
              padding: 40px 20px;
          }
  
          header {
              text-align: center;
              margin-bottom: 60px;
          }
  
          h1 {
              font-size: 2.5em;
              font-weight: 600;
              margin-bottom: 12px;
              color: #fff;
          }
  
          .subtitle {
              font-size: 1.1em;
              color: #888;
          }
  
          .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-bottom: 60px;
          }
  
          .stat-card {
              background: #252525;
              padding: 24px;
              border-radius: 12px;
              border: 1px solid #333;
          }
  
          .stat-card.highlight {
              border: 1px solid #d4956d;
              background: rgba(212, 149, 109, 0.05);
          }
  
          .stat-label {
              font-size: 0.85em;
              color: #888;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
          }
  
          .stat-value {
              font-size: 2em;
              font-weight: 600;
              color: #fff;
          }
  
          .stat-detail {
              font-size: 0.9em;
              color: #666;
              margin-top: 4px;
          }
  
          .section {
              background: #252525;
              border-radius: 12px;
              padding: 32px;
              margin-bottom: 30px;
              border: 1px solid #333;
          }
  
          h2 {
              font-size: 1.5em;
              font-weight: 600;
              margin-bottom: 24px;
              color: #fff;
          }
  
          .chart-wrapper {
              position: relative;
              height: 350px;
              margin-bottom: 20px;
          }
  
          .tabs {
              display: flex;
              gap: 12px;
              margin-bottom: 24px;
              border-bottom: 1px solid #333;
              padding-bottom: 12px;
          }
  
          .tab {
              padding: 8px 16px;
              background: none;
              border: none;
              color: #888;
              cursor: pointer;
              font-size: 0.95em;
              border-radius: 6px;
              transition: all 0.2s;
          }
  
          .tab.active {
              background: #333;
              color: #fff;
          }
  
          .tab-content {
              display: none;
          }
  
          .tab-content.active {
              display: block;
          }
  
          .highlight-text {
              color: #d4956d;
              font-weight: 600;
          }
  
          footer {
              text-align: center;
              margin-top: 60px;
              padding-top: 30px;
              border-top: 1px solid #333;
              color: #666;
              font-size: 0.9em;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <header>
              <h1>Claude Code Startup Benchmarks</h1>
              <p class="subtitle">Comparing --version spawn vs Interactive startup (PTY) across versions</p>
          </header>
  
          <div class="stats-grid">
              <div class="stat-card">
                  <div class="stat-label">--version Tests</div>
                  <div class="stat-value">${versionStats.count}</div>
                  <div class="stat-detail">versions tested</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">--version Average</div>
                  <div class="stat-value">${versionStats.avg}ms</div>
                  <div class="stat-detail">across all versions</div>
              </div>
              <div class="stat-card highlight">
                  <div class="stat-label">--version Fastest</div>
                  <div class="stat-value">${versionStats.min}ms</div>
                  <div class="stat-detail">${versionStats.fastest.version}</div>
              </div>
              ${startupStats ? `
              <div class="stat-card">
                  <div class="stat-label">Interactive Tests</div>
                  <div class="stat-value">${startupStats.count}</div>
                  <div class="stat-detail">versions tested</div>
              </div>
              <div class="stat-card">
                  <div class="stat-label">Interactive Average</div>
                  <div class="stat-value">${startupStats.avg}ms</div>
                  <div class="stat-detail">across all versions</div>
              </div>
              <div class="stat-card highlight">
                  <div class="stat-label">Interactive Fastest</div>
                  <div class="stat-value">${startupStats.min}ms</div>
                  <div class="stat-detail">${startupStats.fastest.version}</div>
              </div>
              ` : ''}
          </div>
  
          <div class="section">
              <div class="tabs">
                  <button class="tab active" onclick="showTab('all')">All Versions</button>
                  <button class="tab" onclick="showTab('02')">0.2.x</button>
                  <button class="tab" onclick="showTab('10')">1.0.x</button>
                  <button class="tab" onclick="showTab('20')">2.0.x</button>
              </div>
  
              <div id="tab-all" class="tab-content active">
                  <h2>All Versions Comparison</h2>
                  <div class="chart-wrapper">
                      <canvas id="chartAll"></canvas>
                  </div>
              </div>
  
              <div id="tab-02" class="tab-content">
                  <h2>0.2.x Versions</h2>
                  <div class="chart-wrapper">
                      <canvas id="chart02"></canvas>
                  </div>
              </div>
  
              <div id="tab-10" class="tab-content">
                  <h2>1.0.x Versions</h2>
                  <div class="chart-wrapper">
                      <canvas id="chart10"></canvas>
                  </div>
              </div>
  
              <div id="tab-20" class="tab-content">
                  <h2>2.0.x Versions</h2>
                  <div class="chart-wrapper">
                      <canvas id="chart20"></canvas>
                  </div>
              </div>
          </div>
  
          <footer>
              <p>Generated: ${new Date().toLocaleString()}</p>
              <p>CVM - Claude Version Manager</p>
          </footer>
      </div>
  
      <script>
          const allData = ${JSON.stringify(mergedData)};
  
          const chartConfig = {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: {
                      display: true,
                      position: 'top',
                      labels: {
                          color: '#e0e0e0',
                          usePointStyle: true,
                          padding: 15
                      }
                  },
                  tooltip: {
                      backgroundColor: '#252525',
                      titleColor: '#fff',
                      bodyColor: '#e0e0e0',
                      borderColor: '#333',
                      borderWidth: 1,
                      callbacks: {
                          title: (context) => 'Version ' + context[0].label,
                          label: (context) => {
                              const dataPoint = allData[context.dataIndex];
                              const isVersion = context.datasetIndex === 0;
  
                              if (isVersion && dataPoint.versionTime) {
                                  return [
                                      '--version: ' + dataPoint.versionTime + 'ms',
                                      'Runs: ' + dataPoint.versionRuns.join('ms, ') + 'ms',
                                      'StdDev: ±' + dataPoint.versionStdDev + 'ms'
                                  ];
                              } else if (!isVersion && dataPoint.startupTime) {
                                  return [
                                      'Interactive: ' + dataPoint.startupTime + 'ms',
                                      'Runs: ' + dataPoint.startupRuns.join('ms, ') + 'ms',
                                      'StdDev: ±' + dataPoint.startupStdDev + 'ms',
                                      'Result: ' + dataPoint.startupResult
                                  ];
                              }
                              return '';
                          }
                      }
                  }
              },
              scales: {
                  y: {
                      beginAtZero: false,
                      grid: { color: '#333' },
                      ticks: { color: '#888' },
                      title: {
                          display: true,
                          text: 'Startup Time (ms)',
                          color: '#888'
                      }
                  },
                  x: {
                      type: 'category',
                      grid: { color: '#333' },
                      ticks: {
                          color: '#888',
                          maxRotation: 90,
                          minRotation: 45,
                          autoSkip: false,
                          maxTicksLimit: 20,
                          callback: function(value, index, ticks) {
                              const totalLabels = ticks.length;
                              const step = Math.ceil(totalLabels / 15);
                              // Show first, last, and every Nth label
                              if (index === 0 || index === totalLabels - 1 || index % step === 0) {
                                  return this.getLabelForValue(value);
                              }
                              return '';
                          }
                      }
                  }
              }
          };
  
          function createChart(canvasId, data) {
              // Find the index of version 1.0.24 (officially supported viable version)
              const viableIndex = data.findIndex(r => r.version === '1.0.24');
  
              new Chart(document.getElementById(canvasId), {
                  type: 'line',
                  data: {
                      labels: data.map(r => r.version),
                      datasets: [
                          {
                              label: '--version spawn',
                              data: data.map(r => r.versionTime),
                              borderColor: '#60a5fa',
                              backgroundColor: 'rgba(96, 165, 250, 0.1)',
                              borderWidth: 2,
                              pointRadius: 1,
                              pointHoverRadius: 5,
                              tension: 0.1,
                              spanGaps: true
                          },
                          {
                              label: 'Interactive startup (PTY)',
                              data: data.map(r => r.startupTime),
                              borderColor: '#d4956d',
                              backgroundColor: 'rgba(212, 149, 109, 0.1)',
                              borderWidth: 2,
                              pointRadius: 1,
                              pointHoverRadius: 5,
                              tension: 0.1,
                              spanGaps: true
                          }
                      ]
                  },
                  options: {
                      ...chartConfig,
                      plugins: {
                          ...chartConfig.plugins,
                          annotation: viableIndex >= 0 ? {
                              annotations: {
                                  viableLine: {
                                      type: 'line',
                                      xMin: viableIndex,
                                      xMax: viableIndex,
                                      borderColor: '#10b981',
                                      borderWidth: 2,
                                      borderDash: [5, 5],
                                      label: {
                                          display: true,
                                          content: '← Pre-1.0.24 | Official Viable Version (1.0.24+) →',
                                          position: 'start',
                                          backgroundColor: 'rgba(16, 185, 129, 0.8)',
                                          color: '#fff',
                                          font: {
                                              size: 11,
                                              weight: 'bold'
                                          }
                                      }
                                  }
                              }
                          } : undefined
                      }
                  }
              });
          }
  
          // All versions
          createChart('chartAll', allData);
  
          // 0.2.x versions
          const data02 = allData.filter(r => r.version.startsWith('0.2.'));
          createChart('chart02', data02);
  
          // 1.0.x versions
          const data10 = allData.filter(r => r.version.startsWith('1.0.'));
          createChart('chart10', data10);
  
          // 2.0.x versions
          const data20 = allData.filter(r => r.version.startsWith('2.0.'));
          createChart('chart20', data20);
  
          function showTab(tab) {
              // Update tab buttons
              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
              event.target.classList.add('active');
  
              // Update tab content
              document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
              document.getElementById('tab-' + tab).classList.add('active');
          }
    </script>
</body>
</html>`;

  const outputFile = 'STARTUP_COMPARISON.html';
  fs.writeFileSync(outputFile, html);
  console.log(`\n✅ Report generated: ${outputFile}`);
  console.log(`   Open in browser to view comparison charts\n`);

  return { html: outputFile, versionResults, interactiveResults };
}

module.exports = {
  generate
};

// Allow running standalone
if (require.main === module) {
  generate();
}
