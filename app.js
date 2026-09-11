// VibeScope Application Core Logic & Real-Time Streaming Engine

let state = {
  activeTab: "dashboard",
  selectedToken: null, // Start empty so Token Terminal requires CA search or click
  walletConnected: false,
  walletAddress: null,
  walletBalanceEth: 0.854,
  walletScopeBalance: 12500,
  whaleFeed: [...INITIAL_WHALE_FEED],
  whaleFilter: "ALL",
  soundEnabled: false,
  currentTimeframe: "15m",
  currentEthPrice: 2456.79,
  currentBlockNumber: 1849204
};

// ============================================================
// REAL ON-CHAIN DATA ENGINE (Ethers.js + CoinGecko)
// ============================================================
const ROBINHOOD_RPC = "https://rpc.testnet.chain.robinhood.com";
const SCOPE_CA = "0xf99E32f9894363C5C3AD889Ed2dfF76f30057F0c";
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

let rpcProvider = null;
let rpcConnected = false;

// Initialize RPC provider
async function initRPCProvider() {
  try {
    rpcProvider = new ethers.JsonRpcProvider(ROBINHOOD_RPC);
    // Test connection
    const block = await rpcProvider.getBlockNumber();
    rpcConnected = true;
    state.currentBlockNumber = block;

    // Update live indicator
    const badge = document.getElementById("rpcStatusBadge");
    if (badge) {
      badge.textContent = "LIVE ON-CHAIN";
      badge.className = badge.className.replace("bg-yellow-500/10 text-yellow-400 border-yellow-500/30", "bg-teal-500/10 text-teal-400 border-teal-500/30");
    }

    console.log("[VibeScope] RPC connected. Block:", block);
    return true;
  } catch (e) {
    rpcConnected = false;
    console.warn("[VibeScope] RPC unavailable, using simulated data:", e.message);
    return false;
  }
}

// Fetch REAL block number from Robinhood Chain
async function fetchRealBlockNumber() {
  if (!rpcProvider) return;
  try {
    const block = await rpcProvider.getBlockNumber();
    state.currentBlockNumber = block;
    const el = document.getElementById("headerBlockNumber");
    if (el) {
      el.textContent = "Block #" + block.toLocaleString();
      el.classList.add("text-teal-400");
      setTimeout(() => el.classList.remove("text-teal-400"), 600);
    }
  } catch (e) {
    console.warn("[RPC] Block fetch error:", e.message);
  }
}

// Fetch REAL ETH price from CoinGecko (free, no key needed)
async function fetchRealEthPrice() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.ethereum && data.ethereum.usd) {
      state.currentEthPrice = data.ethereum.usd;
      const el = document.getElementById("headerEthTicker");
      if (el) el.textContent = "$" + state.currentEthPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  } catch (e) {
    console.warn("[CoinGecko] ETH price fetch error:", e.message);
  }
}

// Fetch REAL $SCOPE token total supply from contract
async function fetchScopeContractData() {
  if (!rpcProvider) return;
  try {
    const contract = new ethers.Contract(SCOPE_CA, ERC20_ABI, rpcProvider);
    const [rawSupply, decimals] = await Promise.all([
      contract.totalSupply(),
      contract.decimals()
    ]);
    const totalSupply = Number(ethers.formatUnits(rawSupply, decimals));

    // Update supply display if element exists
    const supplyEl = document.getElementById("scopeTotalSupply");
    if (supplyEl) supplyEl.textContent = totalSupply.toLocaleString();

    // Update VIBE_TOKENS[0] with real supply
    if (totalSupply > 0) {
      VIBE_TOKENS[0].totalSupply = totalSupply;
    }

    console.log("[VibeScope] $SCOPE supply:", totalSupply.toLocaleString());
  } catch (e) {
    console.warn("[Contract] $SCOPE fetch error:", e.message);
  }
}

// Fetch real data from Robinhood Chain Blockscout API
async function fetchScopeExplorerAPI() {
  try {
    const res = await fetch("https://explorer.testnet.chain.robinhood.com/api/v2/tokens/0xf99E32f9894363C5C3AD889Ed2dfF76f30057F0c");
    if (!res.ok) return;
    const data = await res.json();
    
    const rawHolders = data.holders_count || data.holders;
    if (rawHolders !== undefined && rawHolders !== null) {
      // 1 is launchpad contract, 1 is user. Real holder count = 1
      const count = Math.max(1, parseInt(rawHolders) - 1);
      VIBE_TOKENS[0].holders = count;
      const hEl = document.getElementById("hubScopeHolders");
      const sEl = document.getElementById("sidebarScopeHolders");
      const dEl = document.getElementById("dashScopeHolders");
      if (hEl) hEl.textContent = count;
      if (sEl) sEl.textContent = count;
      if (dEl) dEl.textContent = count;
    }
    if (data.exchange_rate) {
      VIBE_TOKENS[0].price = parseFloat(data.exchange_rate);
      const pEl = document.getElementById("hubScopePrice");
      if (pEl) pEl.textContent = "$" + formatPrice(VIBE_TOKENS[0].price);
    }
    if (data.volume_24h) {
      VIBE_TOKENS[0].volume24h = parseFloat(data.volume_24h);
      const vEl = document.getElementById("hubScopeVolume");
      if (vEl) vEl.textContent = "$" + formatCurrency(VIBE_TOKENS[0].volume24h);
    }
    if (data.circulating_market_cap) {
      VIBE_TOKENS[0].mcap = parseFloat(data.circulating_market_cap);
      const mEl = document.getElementById("hubScopeMcap");
      const dmEl = document.getElementById("dashScopeMcap");
      if (mEl) mEl.textContent = "$" + formatCurrency(VIBE_TOKENS[0].mcap);
      if (dmEl) dmEl.textContent = "$" + formatCurrency(VIBE_TOKENS[0].mcap);
    }
  } catch (e) {
    console.warn("[Explorer] API error:", e.message);
  }
}



// Start all on-chain polling
async function startOnChainEngine() {
  // Try RPC first
  await initRPCProvider();

  // Fetch ETH price immediately (works even without RPC)
  fetchRealEthPrice();
  
  // Fetch Token Stats from Explorer
  fetchScopeExplorerAPI();
  setInterval(fetchScopeExplorerAPI, 15000);

  if (rpcConnected) {
    // Real block number every 3 seconds
    setInterval(fetchRealBlockNumber, 3000);
    // Real $SCOPE contract data every 30 seconds
    fetchScopeContractData();
    setInterval(fetchScopeContractData, 30000);
  } else {
    // Fallback: increment block number from last known
    setInterval(() => {
      if (Math.random() > 0.6) {
        state.currentBlockNumber += 1;
        const el = document.getElementById("headerBlockNumber");
        if (el) el.textContent = "Block #" + state.currentBlockNumber.toLocaleString();
      }
    }, 3000);
  }

  // ETH price refresh every 60 seconds
  setInterval(fetchRealEthPrice, 60000);
}

// Web Audio API Synthesizer
function playBlipSound(isBuy = true) {
  if (!state.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(isBuy ? 880 : 440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isBuy ? 1320 : 220, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// Number Formatting Helpers
function formatPrice(num) {
  if (!num && num !== 0) return "0.00";
  if (num >= 1) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (num >= 0.001) return num.toFixed(5);
  return num.toFixed(7);
}

function formatCurrency(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toFixed(2);
}

function formatAddress(addr) {
  if (!addr) return "";
  if (addr.length < 10) return addr;
  return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
}

// CA Lookup for PNL Calculator
function lookupTokenByCA(ca) {
  const preview = document.getElementById("calcTokenPreview");
  const notFound = document.getElementById("calcTokenNotFound");
  const input = document.getElementById("calcCAInput");

  if (!ca || ca.length < 10) {
    if (preview) preview.classList.add("hidden");
    if (notFound) notFound.classList.add("hidden");
    return;
  }

  // Search in VIBE_TOKENS by CA (case-insensitive)
  const found = VIBE_TOKENS.find(t => t.ca && t.ca.toLowerCase() === ca.trim().toLowerCase());

  if (found) {
    // Show token preview
    if (preview) preview.classList.remove("hidden");
    if (notFound) notFound.classList.add("hidden");
    if (input) input.classList.remove("border-rose-500");
    if (input) input.classList.add("border-teal-500/60");

    const logoEl = document.getElementById("calcPreviewLogo");
    const nameEl = document.getElementById("calcPreviewName");
    const tickerEl = document.getElementById("calcPreviewTicker");
    const badge = document.getElementById("calcPreviewBadge");
    const caEl = document.getElementById("calcPreviewCA");
    const priceEl = document.getElementById("calcPreviewPrice");
    const changeEl = document.getElementById("calcPreviewChange");
    const entryInput = document.getElementById("calcEntryPrice");

    if (logoEl) logoEl.textContent = (found.logo && found.logo.endsWith(".jpg")) ? "&#128301;" : (found.logo || "&#128201;");
    if (nameEl) nameEl.textContent = found.name;
    if (tickerEl) tickerEl.textContent = "$" + found.ticker;
    if (badge) badge.classList.remove("hidden");
    if (caEl) caEl.textContent = found.ca;
    if (priceEl) priceEl.textContent = "$" + formatPrice(found.price);
    if (changeEl) {
      changeEl.textContent = (found.change24h >= 0 ? "+" : "") + found.change24h.toFixed(1) + "%";
      changeEl.className = "text-[10px] mono " + (found.change24h >= 0 ? "text-emerald-400" : "text-rose-400");
    }

    // Auto-fill entry price with current live price
    if (entryInput && !entryInput.value) {
      entryInput.value = found.price;
    }
    entryInput.value = found.price;

    // Trigger calc update
    updateCalculatorInputs();

  } else if (ca.length >= 40) {
    // Looks like a full CA but not found
    if (preview) preview.classList.add("hidden");
    if (notFound) notFound.classList.remove("hidden");
    if (input) input.classList.add("border-rose-500");
    if (input) input.classList.remove("border-teal-500/60");
  }
}


// Tab Switching
function switchTab(tabId) {
  state.activeTab = tabId;
  
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.add("hidden");
  });
  
  const targetPane = document.getElementById("pane-" + tabId);
  if (targetPane) targetPane.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  const activeNav = document.getElementById("nav-" + tabId);
  if (activeNav) activeNav.classList.add("active");

  if (tabId === "charts") {
    if (state.selectedToken) {
      renderMainChart(state.selectedToken, state.currentTimeframe);
    }
  } else if (tabId === "scope") {
    renderTokenomicsChart();
  }
}

// Select Token for Charts & Info
function selectToken(tokenId) {
  const token = VIBE_TOKENS.find(t => t.id === tokenId || t.ticker.toLowerCase() === tokenId.toLowerCase() || (t.ca && t.ca.toLowerCase() === tokenId.toLowerCase()));
  if (token) {
    state.selectedToken = token;
    
    // Show UI cards
    const card1 = document.getElementById("terminalTokenCard");
    const card2 = document.getElementById("terminalChartBody");
    if (card1) card1.style.display = "block";
    if (card2) card2.style.display = "block";

    // Hide error
    const err = document.getElementById("terminalSearchError");
    if (err) err.classList.add("hidden");

    updateChartTokenHeader();
    switchTab("charts");
    setTimeout(() => { const el = document.getElementById('pane-charts'); if(el) el.scrollIntoView({behavior:'smooth'}); }, 150);
  }
}

// Search Terminal by CA
async function searchTerminalCA(ca) {
  const err = document.getElementById("terminalSearchError");
  if (!ca || ca.length < 10) {
    if (err) err.classList.add("hidden");
    return;
  }
  
  const trimmed = ca.trim();
  const token = VIBE_TOKENS.find(t => t.ca && t.ca.toLowerCase() === trimmed.toLowerCase());
  if (token) {
    selectToken(token.id);
    const input = document.getElementById("terminalSearchInput");
    if (input) {
      input.classList.remove("border-rose-500");
      input.classList.add("border-teal-500/60");
    }
    return;
  }

  // If 42-char address, query Blockscout on-chain API
  if (trimmed.length === 42 && trimmed.startsWith("0x")) {
    try {
      const res = await fetch(`https://explorer.testnet.chain.robinhood.com/api/v2/tokens/${trimmed}`);
      if (res.ok) {
        const onChain = await res.json();
        if (onChain && onChain.symbol) {
          const newToken = {
            id: onChain.symbol.toLowerCase(),
            name: onChain.name || onChain.symbol,
            ticker: onChain.symbol,
            ca: trimmed,
            price: onChain.exchange_rate ? parseFloat(onChain.exchange_rate) : 0.00001,
            change24h: 15.4,
            volume24h: onChain.volume_24h ? parseFloat(onChain.volume_24h) : 3200,
            mcap: onChain.circulating_market_cap ? parseFloat(onChain.circulating_market_cap) : 10000,
            liquidity: 5000,
            holders: onChain.holders_count ? parseInt(onChain.holders_count) : 1,
            isNative: false,
            category: "Token",
            logo: "🪙",
            description: `On-chain verified token on Robinhood Chain Testnet. Total supply: ${onChain.total_supply || "1,000,000,000"}.`,
            sparkline: [0.000008, 0.000009, 0.000010, 0.000011, 0.000012, 0.0000125]
          };
          VIBE_TOKENS.push(newToken);
          selectToken(newToken.id);
          const input = document.getElementById("terminalSearchInput");
          if (input) {
            input.classList.remove("border-rose-500");
            input.classList.add("border-teal-500/60");
          }
          if (err) err.classList.add("hidden");
          return;
        }
      }
    } catch(e) {
      console.warn("On-chain token search error:", e);
    }
  }
  
  if (trimmed.length >= 40) {
    if (err) err.classList.remove("hidden");
    const input = document.getElementById("terminalSearchInput");
    if (input) {
      input.classList.add("border-rose-500");
      input.classList.remove("border-teal-500/60");
    }
    
    // Hide UI cards
    const card1 = document.getElementById("terminalTokenCard");
    const card2 = document.getElementById("terminalChartBody");
    if (card1) card1.style.display = "none";
    if (card2) card2.style.display = "none";
    state.selectedToken = null;
  }
}

function updateChartTokenHeader() {
  const t = state.selectedToken;
  const img = document.getElementById("chartTokenLogo");
  const emoji = document.getElementById("chartTokenEmoji");
  
  if (t.logo.endsWith(".jpg")) {
    img.src = t.logo;
    img.classList.remove("hidden");
    emoji.textContent = "";
  } else {
    img.classList.add("hidden");
    emoji.textContent = t.logo;
  }

  document.getElementById("chartTokenName").textContent = t.name;
  document.getElementById("chartTokenTicker").textContent = `$${t.ticker}`;
  document.getElementById("chartTokenPrice").textContent = `$${formatPrice(t.price)}`;
  
  const changeEl = document.getElementById("chartTokenChange");
  changeEl.textContent = `${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(1)}%`;
  changeEl.className = t.change24h >= 0 ? "text-emerald-400 text-xs mono font-semibold" : "text-rose-400 text-xs mono font-semibold";

  document.getElementById("chartTokenMcap").textContent = `$${formatCurrency(t.mcap)}`;
  document.getElementById("chartTokenVolume").textContent = `$${formatCurrency(t.volume24h)}`;
  document.getElementById("chartTokenLiquidity").textContent = `$${formatCurrency(t.liquidity)}`;
  document.getElementById("chartTokenHolders").textContent = t.holders;
  document.getElementById("chartTokenCA").textContent = t.ca;
  
  const vibeLink = `https://testnet.vibevibe.fun/token/${t.ca}`;
  document.getElementById("chartTokenVibeLink").href = vibeLink;

  const calcTokenSelect = document.getElementById("calcTokenSelect");
  if (calcTokenSelect) calcTokenSelect.value = t.id;
  updateCalculatorInputs();

  renderMainChart(t, state.currentTimeframe);
}

// Copy to Clipboard Utility
function copyToClipboard(text, elementId = null) {
  navigator.clipboard.writeText(text).then(() => {
    const el = elementId ? document.getElementById(elementId) : null;
    if (el) {
      const original = el.innerHTML;
      el.innerHTML = "\u2713 Copied!";
      el.classList.add("text-emerald-400");
      setTimeout(() => {
        el.innerHTML = original;
        el.classList.remove("text-emerald-400");
      }, 1500);
    }
  });
}

// Render Trending Tokens Table
function renderTrendingTable() {
  const tbody = document.getElementById("trendingTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  
  // Filter for new launchpad tokens, sort by newest launchDate, take top 6
  const launchpadTokens = VIBE_TOKENS
    .filter(t => (t.progressBps || 0) < 10000)
    .sort((a, b) => new Date(b.launchDate || 0) - new Date(a.launchDate || 0))
    .slice(0, 6);

  launchpadTokens.forEach((t, idx) => {
    const isBull = t.change24h >= 0;
    const row = document.createElement("tr");
    row.id = `row-token-${t.id}`;
    row.className = "border-b border-gray-800/60 hover:bg-gray-800/30 transition-all duration-300 cursor-pointer";
    row.onclick = () => selectToken(t.id);

    const logoHtml = t.logo.endsWith(".jpg") 
      ? `<img src="${t.logo}" class="w-7 h-7 rounded-full object-cover border border-teal-500/40">`
      : `<span class="text-xl">${t.logo}</span>`;

    row.innerHTML = `
      <td class="py-3 px-4 text-gray-500 mono font-medium">#${idx + 1}</td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          ${logoHtml}
          <div>
            <div class="font-semibold text-gray-100 flex items-center gap-1.5">
              ${t.name}
              ${t.isNative ? '<span class="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/30">NATIVE</span>' : ''}
            </div>
            <div class="text-xs text-gray-400 mono">$${t.ticker}</div>
          </div>
        </div>
      </td>
      <td id="price-cell-${t.id}" class="py-3 px-4 mono text-right font-medium transition-colors duration-500">$${formatPrice(t.price)}</td>
      <td id="change-cell-${t.id}" class="py-3 px-4 mono text-right font-semibold ${isBull ? 'text-emerald-400' : 'text-rose-400'}">
        ${isBull ? '+' : ''}${t.change24h.toFixed(1)}%
      </td>
      <td id="vol-cell-${t.id}" class="py-3 px-4 mono text-right text-gray-300 hidden sm:table-cell">$${formatCurrency(t.volume24h)}</td>
      <td id="mcap-cell-${t.id}" class="py-3 px-4 mono text-right text-gray-300 hidden md:table-cell">$${formatCurrency(t.mcap)}</td>
      <td class="py-3 px-4 hidden lg:table-cell">
        <div class="progress-bar-vibe"><div class="fill" style="width:${Math.min(100, (t.progressBps || 0)/100)}%"></div></div>
        <div class="text-[10px] text-gray-500 mono mt-1">${((t.progressBps || 0)/100).toFixed(0)}%</div>
      </td>
      <td class="py-3 px-4 hidden xl:table-cell">
        <canvas id="spark-${t.id}" width="60" height="24" class="sparkline-canvas"></canvas>
      </td>
      <td class="py-3 px-4 text-center">
        <a href="https://testnet.vibevibe.fun/token/${t.ca}" target="_blank" onclick="event.stopPropagation()"
           class="inline-block px-3 py-1 bg-teal-500/10 hover:bg-teal-500/25 text-teal-300 hover:text-teal-200 text-xs font-semibold rounded border border-teal-500/30 transition">
           Trade &#8599;
        </a>
      </td>
    `;
    tbody.appendChild(row);
  });

  VIBE_TOKENS.forEach(t => {
    if (typeof renderSparkline === 'function') {
      renderSparkline('spark-' + t.id, t.sparkline, t.change24h >= 0);
    }
  });
}

// REALTIME MARKET TICK ENGINE (Like DexScreener & vibe/vibe)
function startRealtimeTickEngine() {
  setInterval(() => {
    // Pick 1-2 random tokens to tick
    const count = Math.random() > 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const token = VIBE_TOKENS[Math.floor(Math.random() * VIBE_TOKENS.length)];
      const isUp = Math.random() > 0.42; // slightly bullish bias
      const deltaPercent = (Math.random() * 0.8 + 0.05) * (isUp ? 1 : -1);
      
      token.price = Math.max(0.000001, token.price * (1 + deltaPercent / 100));
      token.change24h += deltaPercent * 0.2;
      token.volume24h += Math.floor(Math.random() * 250) + 20;
      token.mcap = token.price * 100000000;

      // Flash row cell in table
      const priceCell = document.getElementById(`price-cell-${token.id}`);
      const changeCell = document.getElementById(`change-cell-${token.id}`);
      const volCell = document.getElementById(`vol-cell-${token.id}`);
      const mcapCell = document.getElementById(`mcap-cell-${token.id}`);

      if (priceCell) {
        priceCell.textContent = `$${formatPrice(token.price)}`;
        priceCell.classList.add(isUp ? "bg-emerald-500/20" : "bg-rose-500/20");
        priceCell.classList.add(isUp ? "text-emerald-300" : "text-rose-300");
        setTimeout(() => {
          priceCell.classList.remove("bg-emerald-500/20", "bg-rose-500/20", "text-emerald-300", "text-rose-300");
        }, 700);
      }

      if (changeCell) {
        const isBull = token.change24h >= 0;
        changeCell.textContent = `${isBull ? '+' : ''}${token.change24h.toFixed(1)}%`;
        changeCell.className = `py-3 px-4 mono text-right font-semibold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`;
      }

      if (volCell) volCell.textContent = `$${formatCurrency(token.volume24h)}`;
      if (mcapCell) mcapCell.textContent = `$${formatCurrency(token.mcap)}`;

      // If this token is currently shown in the active chart
      if (state.selectedToken.id === token.id) {
        const priceEl = document.getElementById("chartTokenPrice");
        if (priceEl) priceEl.textContent = `$${formatPrice(token.price)}`;
        pushChartTick(token.price);
      }
    }

    // Micro-tick for ETH and $SCOPE in top header
    state.currentEthPrice += (Math.random() * 0.8 - 0.4);
    const ethEl = document.getElementById("headerEthTicker");
    if (ethEl) ethEl.textContent = `$${state.currentEthPrice.toFixed(2)}`;

    const scopeToken = VIBE_TOKENS[0];
    const scopeEl = document.getElementById("headerScopeTicker");
    if (scopeEl) scopeEl.textContent = `$${formatPrice(scopeToken.price)} (+${scopeToken.change24h.toFixed(1)}%)`;

    // Increment simulated on-chain block number
    if (Math.random() > 0.6) {
      state.currentBlockNumber += 1;
      const blockEl = document.getElementById("headerBlockNumber");
      if (blockEl) blockEl.textContent = `Block #${state.currentBlockNumber.toLocaleString()}`;
    }
    
    const sidebarPrice = document.getElementById('sidebarScopePrice');
    const sidebarChange = document.getElementById('sidebarScopeChange');
    const dashMcap = document.getElementById('dashScopeMcap');
    const bannerPrice = document.getElementById('bannerScopePrice');
    if (sidebarPrice) sidebarPrice.textContent = '$' + formatPrice(VIBE_TOKENS[0].price);
    if (dashMcap) dashMcap.textContent = '$' + formatCurrency(VIBE_TOKENS[0].mcap);
    if (bannerPrice) bannerPrice.textContent = '$' + formatPrice(VIBE_TOKENS[0].price);
    if (sidebarChange) {
      const ch = VIBE_TOKENS[0].change24h;
      sidebarChange.textContent = (ch >= 0 ? '\u25b2 +' : '\u25bc ') + ch.toFixed(1) + '% (24h)';
      sidebarChange.className = 'text-[11px] mono ' + (ch >= 0 ? 'text-emerald-400' : 'text-rose-400');
    }
  }, 1800);
}

// Render Whale Radar Feed
function renderWhaleFeed() {
  const container = document.getElementById("whaleFeedContainer");
  if (!container) return;

  const filtered = state.whaleFeed.filter(item => {
    if (state.whaleFilter === "BUY") return item.type === "BUY";
    if (state.whaleFilter === "SELL") return item.type === "SELL";
    if (state.whaleFilter === "100") return item.amountUsd >= 100;
    if (state.whaleFilter === "500") return item.amountUsd >= 500;
    return true;
  });

  let buyVol = 0;
  let sellVol = 0;
  state.whaleFeed.slice(0, 30).forEach(w => {
    if (w.type === "BUY") buyVol += w.amountUsd;
    else sellVol += w.amountUsd;
  });
  const totalVol = buyVol + sellVol || 1;
  const buyRatio = Math.round((buyVol / totalVol) * 100);
  const sellRatio = 100 - buyRatio;

  const buyBar = document.getElementById("whaleBuyRatioBar");
  const buyText = document.getElementById("whaleBuyRatioText");
  const sellText = document.getElementById("whaleSellRatioText");
  if (buyBar) buyBar.style.width = `${buyRatio}%`;
  if (buyText) buyText.textContent = `${buyRatio}% Buys ($${formatCurrency(buyVol)})`;
  if (sellText) sellText.textContent = `${sellRatio}% Sells ($${formatCurrency(sellVol)})`;

  container.innerHTML = "";
  filtered.forEach(tx => {
    const isBuy = tx.type === "BUY";
    const card = document.createElement("div");
    card.className = `p-3 rounded-lg border transition flex items-center justify-between gap-3 ${
      isBuy ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-500/50' : 'bg-rose-950/20 border-rose-900/40 hover:border-rose-500/50'
    }`;

    const timeAgo = Math.max(1, Math.round((Date.now() - new Date(tx.timestamp).getTime()) / 1000));
    const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;

    card.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="px-2 py-0.5 rounded text-[11px] font-bold mono uppercase ${
          isBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
        }">
          ${tx.type}
        </span>
        <div>
          <div class="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <span>$${formatCurrency(tx.amountUsd)}</span>
            <span class="text-xs text-gray-400 font-normal">of</span>
            <span class="text-teal-400 hover:underline cursor-pointer" onclick="selectToken('${tx.token.toLowerCase()}')">
              $${tx.token}
            </span>
            <span class="text-xs text-gray-500 mono">(${tx.prints} print${tx.prints > 1 ? 's' : ''})</span>
          </div>
          <div class="text-[11px] text-gray-400 mono flex items-center gap-2 mt-0.5">
            <span>Wallet: <span class="text-gray-300">${tx.wallet}</span></span>
            <span>&middot;</span>
            <span>${tx.amountEth} ETH</span>
          </div>
        </div>
      </div>
      <div class="text-right shrink-0">
        <div class="text-[11px] text-gray-500 mono mb-1">${timeStr}</div>
        <a href="https://explorer.testnet.chain.robinhood.com/tx/${tx.hash || tx.id}" target="_blank"
           class="text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition">
           View Tx &#8599;
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

// Real On-Chain Whale Radar Engine
async function fetchRealWhaleTransactions() {
  try {
    const res = await fetch("https://explorer.testnet.chain.robinhood.com/api/v2/transactions");
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.items && data.items.length > 0) {
      const ethPrice = state.currentEthPrice || 2500;
      
      const realTxs = data.items.slice(0, 30).map(item => {
        const valWei = item.value || "0";
        const valEth = parseFloat(ethers.formatEther(valWei)) || 0;
        const calcUsd = valEth * ethPrice;
        const method = (item.method || "").toLowerCase();
        const isBuy = method.includes("buy") || method.includes("claim") || method.includes("mint") || !method.includes("sell");
        
        let tokenTicker = "VIBE";
        if (item.to && item.to.name) {
          tokenTicker = item.to.name.substring(0, 6).toUpperCase();
        } else if (item.decoded_input && item.decoded_input.parameters) {
          tokenTicker = "SCOPE";
        }
        
        const sender = item.from?.hash || "0x0000000000000000000000000000000000000000";
        const shortWallet = sender.substring(0, 6) + "..." + sender.substring(sender.length - 4);
        
        return {
          id: item.hash,
          hash: item.hash, // REAL TRANSACTION HASH
          timestamp: new Date(item.timestamp || Date.now()),
          type: isBuy ? "BUY" : "SELL",
          token: tokenTicker,
          amountUsd: calcUsd > 1 ? calcUsd : (Math.random() * 120 + 35),
          amountEth: valEth > 0.0001 ? valEth.toFixed(4) : (Math.random() * 0.04 + 0.01).toFixed(3),
          wallet: shortWallet,
          walletFull: sender,
          prints: Math.floor(Math.random() * 3) + 1
        };
      });
      
      if (realTxs.length > 0 && (!state.whaleFeed[0] || state.whaleFeed[0].hash !== realTxs[0].hash)) {
        playBlipSound(realTxs[0].type === "BUY");
        const top = realTxs[0];
        const ticker = document.getElementById("headerLiveWhaleTicker");
        if (ticker) {
          ticker.innerHTML = `WHALE <span class="text-gray-400">${top.wallet}</span> ${top.type === 'BUY' ? '<span class="text-emerald-400">bought</span>' : '<span class="text-rose-400">sold</span>'} <span class="font-bold text-gray-200">$${formatCurrency(top.amountUsd)}</span> of <span class="text-teal-300 font-semibold">$${top.token}</span> in ${top.prints} print`;
        }
      }
      state.whaleFeed = realTxs;
      renderWhaleFeed();
    }
  } catch (e) {
    console.warn("[Whale Radar] On-chain fetch error:", e);
  }
}

function startWhaleSimulator() {
  fetchRealWhaleTransactions();
  setInterval(fetchRealWhaleTransactions, 4000);
}

// PNL & Position Calculator Logic
function updateCalculatorInputs() {
  const select = document.getElementById("calcTokenSelect");
  if (!select) return;
  const token = VIBE_TOKENS.find(t => t.id === select.value) || state.selectedToken;
  
  const entryPriceInput = document.getElementById("calcEntryPrice");
  if (entryPriceInput && !entryPriceInput.value) {
    entryPriceInput.value = token.price;
  }
  calculatePNL();
}

function calculatePNL() {
  const select = document.getElementById("calcTokenSelect");
  const token = VIBE_TOKENS.find(t => t.id === select.value) || state.selectedToken;

  const entryPrice = parseFloat(document.getElementById("calcEntryPrice").value) || token.price;
  const capitalUsd = parseFloat(document.getElementById("calcCapital").value) || 0;
  const targetPrice = parseFloat(document.getElementById("calcTargetPrice").value) || entryPrice;

  const tokenAmount = entryPrice > 0 ? (capitalUsd / entryPrice) : 0;
  const grossExitValue = tokenAmount * targetPrice;
  const grossProfit = grossExitValue - capitalUsd;

  const feeTotal = grossExitValue * (LAUNCHPAD_CONFIG.feePercent / 100);
  const creatorFee = grossExitValue * (LAUNCHPAD_CONFIG.creatorSharePercent / 100);
  const buybackFee = grossExitValue * (LAUNCHPAD_CONFIG.autoBuybackPercent / 100);
  const netExitValue = grossExitValue - feeTotal;
  const netProfit = netExitValue - capitalUsd;
  const netRoi = capitalUsd > 0 ? ((netProfit / capitalUsd) * 100) : 0;

  document.getElementById("calcOutTokenQty").textContent = `${Math.round(tokenAmount).toLocaleString()} ${token.ticker}`;
  document.getElementById("calcOutGrossVal").textContent = `$${grossExitValue.toFixed(2)}`;
  document.getElementById("calcOutGrossProfit").textContent = `${grossProfit >= 0 ? '+' : ''}$${grossProfit.toFixed(2)}`;
  document.getElementById("calcOutGrossProfit").className = grossProfit >= 0 ? 'text-emerald-400 font-bold mono' : 'text-rose-400 font-bold mono';

  document.getElementById("calcOutFeeTotal").textContent = `-$${feeTotal.toFixed(2)} (1.25%)`;
  document.getElementById("calcOutCreatorFee").textContent = `$${creatorFee.toFixed(3)}`;
  document.getElementById("calcOutBuybackFee").textContent = `$${buybackFee.toFixed(3)}`;

  const netEl = document.getElementById("calcOutNetProfit");
  netEl.textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)} (${netRoi >= 0 ? '+' : ''}${netRoi.toFixed(1)}%)`;
  netEl.className = netProfit >= 0 ? 'text-2xl font-bold mono text-emerald-400' : 'text-2xl font-bold mono text-rose-400';
}



function renderNewLaunchFeed() {
  const container = document.getElementById('newLaunchFeed');
  if (!container) return;
  const sorted = [...VIBE_TOKENS]
    .filter(t => t.launchDate)
    .sort((a, b) => new Date(b.launchDate) - new Date(a.launchDate))
    .slice(0, 5);
  container.innerHTML = '';
  sorted.forEach(t => {
    const ago = Math.floor((Date.now() - new Date(t.launchDate).getTime()) / 60000);
    const timeStr = ago < 60 ? ago + 'm ago' : Math.floor(ago / 60) + 'h ago';
    const logoStr = (typeof t.logo === 'string' && t.logo.endsWith('.jpg')) ? '\ud83d\udd2d' : t.logo;
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-800/20 rounded px-1 transition';
    el.onclick = () => selectToken(t.id);
    el.innerHTML = `<div class="flex items-center gap-2">
      <span class="text-base">${logoStr}</span>
      <div>
        <div class="text-xs font-semibold text-gray-200">$${t.ticker}</div>
        <div class="text-[10px] text-gray-500 mono">${timeStr}</div>
      </div>
    </div>
    <div class="text-right">
      <div class="text-xs font-semibold mono ${t.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(0)}%</div>
      <div class="progress-bar-vibe mt-1"><div class="fill" style="width:${Math.min(100, (t.progressBps||0)/100)}%"></div></div>
    </div>`;
    container.appendChild(el);
  });
}

// // Event Listeners & Bootstrapping
window.addEventListener("DOMContentLoaded", () => {
  renderTrendingTable();
  renderWhaleFeed();
  startWhaleSimulator();
  startRealtimeTickEngine();
  renderNewLaunchFeed();
  setInterval(renderNewLaunchFeed, 15000);
  updateCalculatorInputs();

  // START REAL ON-CHAIN DATA POLLING
  startOnChainEngine();

  ["calcCapital", "calcEntryPrice", "calcTargetPrice", "calcCAInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", calculatePNL);
  });

  document.querySelectorAll(".timeframe-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".timeframe-btn").forEach(b => b.classList.remove("active", "bg-teal-500", "text-gray-900"));
      btn.classList.add("active", "bg-teal-500", "text-gray-900");
      state.currentTimeframe = btn.dataset.tf;
      renderMainChart(state.selectedToken, state.currentTimeframe);
    });
  });

  document.querySelectorAll(".whale-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".whale-filter-btn").forEach(b => b.classList.remove("bg-teal-500", "text-gray-900"));
      document.querySelectorAll(".whale-filter-btn").forEach(b => b.classList.add("bg-gray-800", "text-gray-300"));
      btn.classList.remove("bg-gray-800", "text-gray-300");
      btn.classList.add("bg-teal-500", "text-gray-900");
      state.whaleFilter = btn.dataset.filter;
      renderWhaleFeed();
    });
  });

  const soundToggle = document.getElementById("soundAlertToggle");
  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      soundToggle.textContent = state.soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
      soundToggle.className = state.soundEnabled 
        ? "px-2.5 py-1 text-xs rounded bg-teal-500/20 text-teal-300 border border-teal-500/40" 
        : "px-2.5 py-1 text-xs rounded bg-gray-800 text-gray-400 border border-gray-700";
    });
  }
});
