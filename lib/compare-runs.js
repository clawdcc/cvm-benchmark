#!/usr/bin/env node
/**
 * Compare Multiple Benchmark Runs
 *
 * Generates HTML report overlaying multiple benchmark runs to show consistency
 */

const fs = require('fs');
const path = require('path');

/**
 * Compare multiple benchmark runs and generate HTML report
 */
function compare(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    runs = ['1'];
  }

  // Load data for each run
  const runData = runs.map(runNum => {
    const runDir = `./benchmarks/run-${runNum}`;

    if (!fs.existsSync(runDir)) {
      console.error(`❌ Run ${runNum} not found at ${runDir}`);
      process.exit(1);
    }

    // Load version benchmarks
    const versionFile = path.join(runDir, 'version', 'benchmarks-all-3run.json');
    const versionBench = fs.existsSync(versionFile) ? JSON.parse(fs.readFileSync(versionFile)) : null;

    // Load interactive benchmarks
    const interactiveDir = path.join(runDir, 'interactive');
    const interactiveFiles = fs.existsSync(interactiveDir) ?
      fs.readdirSync(interactiveDir).filter(f => f.startsWith('benchmark-startup-') && f.endsWith('.json')) : [];

    const interactiveBench = interactiveFiles.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(interactiveDir, f)));
      const times = data.data.results.map(r => r.time);
      const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
      const stdDev = Math.round(Math.sqrt(variance));

      return {
        version: data.data.version,
        avgTime,
        runs: times,
        stdDev,
        result: data.data.results[0].result
      };
    });

    const metadata = JSON.parse(fs.readFileSync(path.join(runDir, 'metadata.json')));

    console.log(`✅ Loaded Run ${runNum}:`);
    console.log(`   - Timestamp: ${new Date(metadata.timestamp).toLocaleString()}`);
    console.log(`   - Version benchmarks: ${versionBench ? versionBench.results.length : 0}`);
    console.log(`   - Interactive benchmarks: ${interactiveBench.length}`);

    return {
      runNum,
      metadata,
      versionBench,
      interactiveBench
    };
  });

  console.log(`\n📈 Generating comparison report...\n`);

  // Get all unique versions
  const allVersions = [...new Set(
    runData.flatMap(r => [
      ...(r.versionBench ? r.versionBench.results.map(v => v.version) : []),
      ...r.interactiveBench.map(v => v.version)
    ])
  )].sort((a, b) => {
    const [aMaj, aMin, aPat] = a.split('.').map(Number);
    const [bMaj, bMin, bPat] = b.split('.').map(Number);
    if (aMaj !== bMaj) return aMaj - bMaj;
    if (aMin !== bMin) return aMin - bMin;
    return aPat - bPat;
  });

  // Prepare chart datasets
  const colors = ['#60a5fa', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  const dashPatterns = [[], [5, 5], [2, 2], [10, 5], [5, 10], [2, 10]];

  const versionDatasets = runData.map((run, idx) => ({
    label: `--version Run ${run.runNum}`,
    data: allVersions.map(v => {
      const result = run.versionBench?.results.find(r => r.version === v);
      return result ? result.avgTime : null;
    }),
    borderColor: colors[idx % colors.length],
    backgroundColor: `${colors[idx % colors.length]}20`,
    borderWidth: 2,
    borderDash: dashPatterns[idx % dashPatterns.length],
    pointRadius: 1,
    pointHoverRadius: 5,
    tension: 0.1,
    spanGaps: true
  }));

  const interactiveDatasets = runData.map((run, idx) => ({
    label: `Interactive Run ${run.runNum}`,
    data: allVersions.map(v => {
      const result = run.interactiveBench.find(r => r.version === v);
      return result ? result.avgTime : null;
    }),
    borderColor: colors[(idx + 3) % colors.length],
    backgroundColor: `${colors[(idx + 3) % colors.length]}20`,
    borderWidth: 2,
    borderDash: dashPatterns[idx % dashPatterns.length],
    pointRadius: 1,
    pointHoverRadius: 5,
    tension: 0.1,
    spanGaps: true
  }));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CVM Benchmark Run Comparison</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 40px 20px; }
        header { text-align: center; margin-bottom: 60px; }
        h1 { font-size: 2.5em; font-weight: 600; margin-bottom: 12px; color: #fff; }
        .subtitle { font-size: 1.1em; color: #888; margin-bottom: 20px; }
        .runs-info { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 40px; }
        .run-badge { background: #252525; padding: 12px 20px; border-radius: 8px; border: 1px solid #333; }
        .run-badge strong { color: #d4956d; }
        .section { background: #252525; border-radius: 12px; padding: 32px; margin-bottom: 30px; border: 1px solid #333; }
        h2 { font-size: 1.5em; font-weight: 600; margin-bottom: 24px; color: #fff; }
        .chart-wrapper { position: relative; height: 400px; margin-bottom: 20px; }
        .note { background: rgba(212, 149, 109, 0.1); border: 1px solid #d4956d; border-radius: 8px; padding: 16px; margin-top: 20px; }
        .note strong { color: #d4956d; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Benchmark Run Comparison</h1>
            <p class="subtitle">Overlay of multiple benchmark runs to verify consistency</p>
            <div class="runs-info">
                ${runData.map(r => `
                <div class="run-badge">
                    <strong>Run ${r.runNum}</strong><br>
                    <small>${new Date(r.metadata.timestamp).toLocaleDateString()}</small>
                    ${r.metadata.notes ? `<br><small style="color: #888;">${r.metadata.notes}</small>` : ''}
                </div>
                `).join('')}
            </div>
        </header>

        <div class="section">
            <h2>All Benchmarks Overlay</h2>
            <div class="chart-wrapper">
                <canvas id="chartAll"></canvas>
            </div>
            <div class="note">
                <strong>Note:</strong> Lines should overlap closely if measurements are consistent.
                Divergence indicates measurement variance or actual performance changes between runs.
            </div>
        </div>
    </div>

    <script>
        const allData = ${JSON.stringify(allVersions)};
        const viableIndex = allData.findIndex(v => v === '1.0.24');

        new Chart(document.getElementById('chartAll'), {
            type: 'line',
            data: {
                labels: allData,
                datasets: [...${JSON.stringify(versionDatasets)}, ...${JSON.stringify(interactiveDatasets)}]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { color: '#e0e0e0', usePointStyle: true, padding: 15 }
                    },
                    tooltip: {
                        backgroundColor: '#252525',
                        titleColor: '#fff',
                        bodyColor: '#e0e0e0',
                        borderColor: '#333',
                        borderWidth: 1
                    },
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
                                    font: { size: 11, weight: 'bold' }
                                }
                            }
                        }
                    } : undefined
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: '#333' },
                        ticks: { color: '#888' },
                        title: { display: true, text: 'Startup Time (ms)', color: '#888' }
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
                                if (index === 0 || index === totalLabels - 1 || index % step === 0) {
                                    return this.getLabelForValue(value);
                                }
                                return '';
                            }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

  fs.writeFileSync('BENCHMARK_RUN_COMPARISON.html', html);
  console.log('✅ Comparison report generated: BENCHMARK_RUN_COMPARISON.html');
  console.log('   Open in browser to view overlaid runs\n');

  return {
    runs: runData,
    html: 'BENCHMARK_RUN_COMPARISON.html'
  };
}

module.exports = {
  compare
};

// Allow running standalone
if (require.main === module) {
  const runs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['1'];
  console.log(`📊 Comparing Benchmark Runs: ${runs.join(', ')}\n`);

  compare(runs);
}
