// ─── Chart instances (kept so we can destroy before re-drawing) ───────────────
let barChart;
let lineChart;

// ─── Theme toggle ─────────────────────────────────────────────────────────────
const toggleBtn  = document.getElementById("toggle-mode");
const htmlEl     = document.documentElement;
const savedTheme = localStorage.getItem("theme");

if (savedTheme) {
  htmlEl.setAttribute("data-theme", savedTheme);
  toggleBtn.textContent = savedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
} else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
  htmlEl.setAttribute("data-theme", "dark");
  toggleBtn.textContent = "Switch to Light Mode";
}

toggleBtn.addEventListener("click", () => {
  const isDark = htmlEl.getAttribute("data-theme") === "dark";
  const next   = isDark ? "light" : "dark";
  htmlEl.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  toggleBtn.textContent = isDark ? "Switch to Dark Mode" : "Switch to Light Mode";

  // Re-draw charts so their colours update for the new theme
  if (barChart)  barChart.destroy();
  if (lineChart) lineChart.destroy();
  applyFilters();
});

// ─── Build URL query string from filter controls ───────────────────────────────
function buildQueryParams() {
  const vendor   = document.getElementById("vendor").value;
  const minPrice = document.getElementById("min_price").value;
  const maxPrice = document.getElementById("max_price").value;
  const fromZone = document.getElementById("from-zone").value;
  const toZone   = document.getElementById("to-zone").value;

  const params = new URLSearchParams();
  if (vendor)   params.append("vendor",    vendor);
  if (minPrice) params.append("min_price", minPrice);
  if (maxPrice) params.append("max_price", maxPrice);
  if (fromZone) params.append("from_zone", fromZone);
  if (toZone)   params.append("to_zone",   toZone);

  return params.toString();
}

// ─── Main: fetch both endpoints in parallel, then render ──────────────────────
function applyFilters() {
  const qs = buildQueryParams();
  setTableLoading(true);

  Promise.all([
    fetch(`/analytics/price-summary?${qs}`).then(r => r.json()),
    fetch(`/analytics/trips?${qs}&limit=100`).then(r => r.json()),
  ])
    .then(([summaryData, tripsData]) => {
      updateCharts(summaryData, tripsData); // pass tripsData for the speed/distance line chart
      updateTable(tripsData);
    })
    .catch(err => {
      console.error("Fetch error:", err);
      setTableLoading(false, "Error loading data. Check the console.");
    });
}

// ─── Populate zone dropdowns from /analytics/zones ────────────────────────────
function loadZones() {
  fetch("/analytics/zones")
    .then(r => r.json())
    .then(list => {
      if (!Array.isArray(list)) return;
      const fromEl = document.getElementById("from-zone");
      const toEl   = document.getElementById("to-zone");

      // keep the first "Any zone" placeholder, remove the rest
      while (fromEl.options.length > 1) fromEl.remove(1);
      while (toEl.options.length   > 1) toEl.remove(1);

      list.forEach(z => {
        fromEl.appendChild(new Option(z, z));
        toEl.appendChild(new Option(z, z));
      });
    })
    .catch(err => console.debug("Could not load zones:", err));
}

// ─── Table helpers ────────────────────────────────────────────────────────────
function setTableLoading(loading, msg) {
  const status = document.getElementById("table-status");
  const table  = document.getElementById("trips-table");
  if (loading) {
    status.textContent  = msg || "Loading trips…";
    status.style.display = "block";
    table.style.display  = "none";
  } else {
    status.style.display = msg ? "block" : "none";
    if (msg) status.textContent = msg;
    table.style.display  = msg ? "none" : "table";
  }
}

function formatDateTime(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Render trips table ───────────────────────────────────────────────────────
// Columns now include the new fields returned by app.py:
//   passenger_count, trip_duration, trip_speed, fare_per_mile,
//   pickup_zone / pickup_borough, dropoff_zone / dropoff_borough
function updateTable(data) {
  const tbody = document.querySelector("#trips-table tbody");
  // Also update the <thead> to match the new columns
  const thead = document.querySelector("#trips-table thead tr");
  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    setTableLoading(false, "No trips found for the selected filters.");
    // clear mobile list too
    const ml = document.getElementById('mobile-list');
    if (ml) ml.innerHTML = '';
    return;
  }

  // Rebuild header to match all columns we now show
  thead.innerHTML = `
    <th>Vendor</th>
    <th>Pickup time</th>
    <th>Dropoff time</th>
    <th>Pickup zone</th>
    <th>Dropoff zone</th>
    <th>Passengers</th>
    <th>Distance (mi)</th>
    <th>Duration (min)</th>
    <th>Speed (mph)</th>
    <th>Fare</th>
    <th>$/mile</th>
    <th>Total</th>
  `;

  setTableLoading(false);

  // Build mobile list HTML alongside table rows
  const mobileItems = [];

  data.forEach(item => {
    // Build a readable zone string: "Zone, Borough" or fall back to the numeric ID
    const puLabel = item.pickup_zone
      ? `${item.pickup_zone}, ${item.pickup_borough}`
      : item.PULocationID;
    const doLabel = item.dropoff_zone
      ? `${item.dropoff_zone}, ${item.dropoff_borough}`
      : item.DOLocationID;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="vendor-badge vendor-${item.VendorID}">V${item.VendorID}</span></td>
      <td>${formatDateTime(item.tpep_pickup_datetime)}</td>
      <td>${formatDateTime(item.tpep_dropoff_datetime)}</td>
      <td>${puLabel}</td>
      <td>${doLabel}</td>
      <td>${item.passenger_count ?? "—"}</td>
      <td>${item.trip_distance != null ? Number(item.trip_distance).toFixed(2) : "—"}</td>
      <td>${item.trip_duration != null ? item.trip_duration : "—"}</td>
      <td>${item.trip_speed   != null ? Number(item.trip_speed).toFixed(1)   : "—"}</td>
      <td class="fare">$${Number(item.fare_amount).toFixed(2)}</td>
      <td>${item.fare_per_mile != null ? "$" + Number(item.fare_per_mile).toFixed(2) : "—"}</td>
      <td class="fare">$${Number(item.total_amount ?? item.fare_amount).toFixed(2)}</td>
    `;
    tbody.appendChild(row);

    // push mobile item data for later rendering
    mobileItems.push({
      vendor: item.VendorID,
      pickup: formatDateTime(item.tpep_pickup_datetime),
      dropoff: formatDateTime(item.tpep_dropoff_datetime),
      pickup_zone: puLabel,
      dropoff_zone: doLabel,
      passengers: item.passenger_count ?? "—",
      distance: item.trip_distance != null ? Number(item.trip_distance).toFixed(2) : "—",
      duration: item.trip_duration != null ? item.trip_duration : "—",
      speed: item.trip_speed != null ? Number(item.trip_speed).toFixed(1) : "—",
      fare: item.fare_amount != null ? Number(item.fare_amount).toFixed(2) : "—",
      per_mile: item.fare_per_mile != null ? Number(item.fare_per_mile).toFixed(2) : null,
      total: Number(item.total_amount ?? item.fare_amount).toFixed(2),
    });
  });

  // render mobile list (JS will show/hide via CSS based on viewport)
  renderMobileList(mobileItems);
}

// Render small-item cards for mobile/tablet
function renderMobileList(items) {
  const container = document.getElementById('mobile-list');
  if (!container) return;
  if (!items || items.length === 0) { container.innerHTML = ''; return; }

  // build HTML string for performance
  const html = items.map(it => {
    const perMile = it.per_mile != null ? `$${it.per_mile}/mi` : '—';
    return `
      <article class="small-item">
        <header class="si-header">
          <span class="vendor-badge vendor-${it.vendor}">V${it.vendor}</span>
          <div class="si-times">
            <div class="si-pick">${it.pickup}</div>
            <div class="si-drop">${it.dropoff}</div>
          </div>
        </header>
        <div class="si-body">
          <div class="si-row"><strong>From:</strong> <span>${escapeHtml(it.pickup_zone)}</span></div>
          <div class="si-row"><strong>To:</strong> <span>${escapeHtml(it.dropoff_zone)}</span></div>
          <div class="si-row si-meta">
            <span>Passengers: ${it.passengers}</span>
            <span>Distance: ${it.distance} mi</span>
            <span>Duration: ${it.duration} min</span>
            <span>Speed: ${it.speed} mph</span>
          </div>
        </div>
        <footer class="si-footer">
          <div class="si-fare">Fare: <span class="fare">$${it.fare}</span></div>
          <div class="si-total">Total: <span class="fare">$${it.total}</span></div>
          <div class="si-permile">${perMile}</div>
        </footer>
      </article>
    `;
  }).join('');

  container.innerHTML = html;
}

// simple escape to avoid accidental HTML injection from DB strings
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Render charts ────────────────────────────────────────────────────────────
// summaryData  → from /analytics/price-summary  (grouped by vendor: min/avg/max fare)
// tripsData    → from /analytics/trips          (individual rows with trip_speed, trip_distance)

// Custom external tooltip that renders HTML (so <b> and <br/> work as requested)
function externalHtmlTooltip(context) {
  // Tooltip element
  let tooltipEl = document.getElementById('chartjs-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'chartjs-tooltip';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.background = 'rgba(0,0,0,0.75)';
    tooltipEl.style.color = '#fff';
    tooltipEl.style.padding = '6px 8px';
    tooltipEl.style.borderRadius = '6px';
    tooltipEl.style.fontFamily = 'DM Mono, monospace';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.zIndex = 2000;
    document.body.appendChild(tooltipEl);
  }

  const tooltipModel = context.tooltip;
  // Hide if no tooltip
  if (!tooltipModel || tooltipModel.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // Use first dataPoint for content
  const dataPoint = (tooltipModel.dataPoints && tooltipModel.dataPoints[0]) || null;
  let xVal = '';
  let yVal = '';

  if (dataPoint) {
    // category label (bar) is in dataPoint.label
    if (dataPoint.label) {
      xVal = dataPoint.label;
    } else if (dataPoint.parsed && dataPoint.parsed.x != null) {
      xVal = dataPoint.parsed.x;
    } else if (dataPoint.raw && dataPoint.raw.x != null) {
      xVal = dataPoint.raw.x;
    }

    if (dataPoint.parsed && dataPoint.parsed.y != null) {
      yVal = dataPoint.parsed.y;
    } else if (dataPoint.raw && dataPoint.raw.y != null) {
      yVal = dataPoint.raw.y;
    } else if (dataPoint.formattedValue) {
      yVal = dataPoint.formattedValue;
    }
  }

  // Format values: timestamp -> human string, numbers -> 2 decimals
  if (typeof xVal === 'number') xVal = new Date(xVal).toLocaleString();
  if (typeof yVal === 'number') yVal = Number(yVal).toFixed(2);

  // Build HTML content exactly as requested
  tooltipEl.innerHTML = `<b>Area: </b>${xVal} sq.ft<br/><b>Price: </b>$${yVal}k`;

  // Position the tooltip near the caret within the chart canvas
  const canvasRect = context.chart.canvas.getBoundingClientRect();
  const caretX = tooltipModel.caretX || (tooltipModel.x || 0);
  const caretY = tooltipModel.caretY || (tooltipModel.y || 0);
  const left = canvasRect.left + window.scrollX + caretX + 10;
  const top  = canvasRect.top  + window.scrollY + caretY - 40;

  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top  = top  + 'px';
  tooltipEl.style.opacity = 1;
}

function updateCharts(summaryData, tripsData) {
  if (barChart)  barChart.destroy();
  if (lineChart) lineChart.destroy();

  // Detect current theme so chart text colour stays readable
  const isDark  = htmlEl.getAttribute("data-theme") === "dark";
  const textClr = isDark ? "#cbc9e2" : "#333";
  const gridClr = isDark ? "#2e2d44" : "#f0f0f0";

  // ── Bar chart: average fare per vendor ──────────────────────────────────────
  const barLabels   = summaryData.map(d => "Vendor " + d.VendorID);
  const barAverages = summaryData.map(d => parseFloat(d.avg_price).toFixed(2));
  const barMins     = summaryData.map(d => parseFloat(d.min_price).toFixed(2));
  const barMaxes    = summaryData.map(d => parseFloat(d.max_price).toFixed(2));

  // build bar chart options and use the external HTML tooltip
  const barOptions = buildChartOptions("Fare ($)", textClr, gridClr);
  barOptions.plugins = barOptions.plugins || {};
  barOptions.plugins.tooltip = {
    enabled: false, // disable default tooltip rendering
    external: externalHtmlTooltip,
  };

  barChart = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [
        {
          label: "Min Fare ($)",
          data: barMins,
          backgroundColor: "rgba(141,96,152,0.5)",   // accent
          borderColor:     "rgba(141,96,152,1)",
          borderWidth: 2,
          borderRadius: 4,
        },
        {
          label: "Avg Fare ($)",
          data: barAverages,
          backgroundColor: "rgba(39,72,8,0.7)",       // primary
          borderColor:     "rgba(39,72,8,1)",
          borderWidth: 2,
          borderRadius: 4,
        },
        {
          label: "Max Fare ($)",
          data: barMaxes,
          backgroundColor: "rgba(222,220,255,0.8)",   // secondary
          borderColor:     "rgba(141,96,152,0.8)",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    },
    options: barOptions,
  });

  // ── Scatter chart: pickup time (x) vs distance (y), coloured by vendor ─────
  // Build vendor groups where x is pickup timestamp (ms) and y is trip_distance (mi)
  const vendorGroups = {};
  (tripsData || []).forEach(row => {
    if (row.trip_distance == null || !row.tpep_pickup_datetime) return;
    const t = new Date(row.tpep_pickup_datetime);
    if (isNaN(t)) return;
    const x = t.getTime();
    const y = Number(row.trip_distance);
    const vid = "Vendor " + row.VendorID;
    if (!vendorGroups[vid]) vendorGroups[vid] = [];
    vendorGroups[vid].push({ x: x, y: y });
  });

  const vendorColors = {
    "Vendor 1": { border: "rgba(39,72,8,1)",    bg: "rgba(39,72,8,0.08)"    },
    "Vendor 2": { border: "rgba(141,96,152,1)",  bg: "rgba(141,96,152,0.08)" },
  };

  const scatterDatasets = Object.entries(vendorGroups).map(([label, points]) => ({
    label,
    data:            points,
    borderColor:     vendorColors[label]?.border || "rgba(100,100,200,1)",
    backgroundColor: vendorColors[label]?.bg     || "rgba(100,100,200,0.12)",
    pointRadius:     4,
    showLine:        false,
  }));

  // build scatter options with time-formatted x-axis ticks and external tooltip
  const scatterOptions = buildChartOptions("Distance (mi)", textClr, gridClr);
  scatterOptions.scales = scatterOptions.scales || {};
  scatterOptions.scales.x = {
    type: 'linear', // timestamps in ms
    title: { display: true, text: 'Pickup time', color: textClr, font: { family: 'DM Mono' } },
    ticks: {
      callback: function(value) {
        try {
          return new Date(value).toLocaleString();
        } catch (e) {
          return value;
        }
      },
      color: textClr,
      font: { family: 'DM Mono' }
    },
    grid: { color: gridClr },
  };
  scatterOptions.scales.y = {
    title: { display: true, text: 'Distance (mi)', color: textClr, font: { family: 'DM Mono' } },
    ticks: { font: { family: 'DM Mono' }, color: textClr },
    grid:  { color: gridClr },
  };

  scatterOptions.plugins = scatterOptions.plugins || {};
  scatterOptions.plugins.tooltip = {
    enabled: false,
    external: externalHtmlTooltip,
  };

  lineChart = new Chart(document.getElementById("lineChart"), {
    type: "scatter",
    data: { datasets: scatterDatasets },
    options: scatterOptions,
  });
}

// ─── Shared Chart.js options factory ──────────────────────────────────────────
// Extracted into a function so both charts use the same base and we can
// pass theme-aware colours without repeating ourselves (DRY principle).
function buildChartOptions(yLabel, textClr, gridClr) {
  return {
    responsive:          true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { font: { family: "DM Mono", size: 12 }, color: textClr },
      },
    },
    scales: {
      x: {
        ticks: { font: { family: "DM Mono" }, color: textClr },
        grid:  { color: gridClr },
      },
      y: {
        title: { display: true, text: yLabel, color: textClr, font: { family: "DM Mono" } },
        ticks: { font: { family: "DM Mono" }, color: textClr },
        grid:  { color: gridClr },
      },
    },
  };
}

// ─── Bootstrap on page load ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadZones();   // fill dropdowns from DB, then...
  applyFilters(); // load initial data
});