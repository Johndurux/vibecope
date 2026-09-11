function renderSparkline(canvasId, data, isPositive) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data || data.length < 2) return;
  try {
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{ data: data, borderColor: isPositive ? '#14DBD1' : '#EF4444', borderWidth: 1.5, fill: false, tension: 0.4, pointRadius: 0 }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  } catch(e) { console.warn('sparkline error', e); }
}
// VibeScope Charting Engine (Chart.js Integration with Live Realtime Updates)

let mainPriceChart = null;
let tokenomicsChart = null;

function renderMainChart(token, timeframe = "15m") {
  const ctx = document.getElementById("mainPriceChartCanvas");
  if (!ctx) return;

  const pointsCount = timeframe === "1m" ? 30 : timeframe === "5m" ? 35 : timeframe === "15m" ? 40 : 50;
  const labels = [];
  const prices = [];

  let currentPrice = token.price * (1 - (token.change24h / 200));
  const now = Date.now();
  const stepMs = timeframe === "1m" ? 60000 : timeframe === "5m" ? 300000 : timeframe === "15m" ? 900000 : 3600000;

  for (let i = pointsCount; i >= 0; i--) {
    const t = new Date(now - (i * stepMs));
    labels.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    const volatility = currentPrice * 0.02;
    const change = (Math.random() - 0.48) * volatility;
    currentPrice = Math.max(0.000001, currentPrice + change);
    prices.push(currentPrice);
  }
  
  prices[prices.length - 1] = token.price;

  if (mainPriceChart) {
    mainPriceChart.destroy();
  }

  const isBullish = token.change24h >= 0;
  const lineColor = isBullish ? '#14DBD1' : '#EF4444';
  const fillColor = isBullish ? 'rgba(20, 219, 209, 0.12)' : 'rgba(239, 68, 68, 0.12)';

  mainPriceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `${token.ticker} Price (USD)`,
          data: prices,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: lineColor,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 400
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d121d',
          titleColor: '#9ca3af',
          bodyColor: '#f3f4f6',
          borderColor: '#1e2a3a',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return ` Price: $${formatPrice(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#6b7280', maxTicksLimit: 8 }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#9ca3af',
            callback: function(val) {
              return '$' + formatPrice(val);
            }
          }
        }
      }
    }
  });
}

// Push live micro-tick to active chart
function pushChartTick(newPrice) {
  if (!mainPriceChart) return;
  const data = mainPriceChart.data.datasets[0].data;
  if (data && data.length > 0) {
    data[data.length - 1] = newPrice;
    mainPriceChart.update('none'); // silent fast update
  }
}

// Render $SCOPE Tokenomics Donut Chart
function renderTokenomicsChart() {
  const ctx = document.getElementById("tokenomicsChartCanvas");
  if (!ctx) return;

  if (tokenomicsChart) {
    tokenomicsChart.destroy();
  }

  tokenomicsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        'Community Rewards & Testnet (40%)',
        'Ecosystem Development (25%)',
        'Liquidity Pool (20%)',
        'Team & Advisors Locked (10%)',
        'Marketing & Growth (5%)'
      ],
      datasets: [{
        data: [40, 25, 20, 10, 5],
        backgroundColor: [
          '#14DBD1',
          '#10B981',
          '#6366F1',
          '#F59E0B',
          '#EC4899'
        ],
        borderColor: '#0d121d',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#d1d5db',
            padding: 14,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#070a11',
          titleColor: '#fff',
          bodyColor: '#14DBD1',
          borderColor: '#1a2333',
          borderWidth: 1
        }
      },
      cutout: '70%'
    }
  });
}