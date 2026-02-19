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
  });
}

// ─── Render charts ────────────────────────────────────────────────────────────
// summaryData  → from /analytics/price-summary  (grouped by vendor: min/avg/max fare)
// tripsData    → from /analytics/trips          (individual rows with trip_speed, trip_distance)
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
    options: buildChartOptions("Fare ($)", textClr, gridClr),
  });

  // ── Line chart: trip speed vs distance, coloured by vendor ─────────────────
  // We group tripsData rows by VendorID, then plot distance (x) vs speed (y)
  // so the chart shows "how fast vendors travel for different trip lengths"

  const vendorGroups = {};
  (tripsData || []).forEach(row => {
    if (row.trip_distance == null || row.trip_speed == null) return;
    const vid = "Vendor " + row.VendorID;
    if (!vendorGroups[vid]) vendorGroups[vid] = [];
    vendorGroups[vid].push({ x: Number(row.trip_distance).toFixed(2), y: Number(row.trip_speed).toFixed(1) });
  });

  const vendorColors = {
    "Vendor 1": { border: "rgba(39,72,8,1)",    bg: "rgba(39,72,8,0.08)"    },
    "Vendor 2": { border: "rgba(141,96,152,1)",  bg: "rgba(141,96,152,0.08)" },
  };

  const scatterDatasets = Object.entries(vendorGroups).map(([label, points]) => ({
    label,
    data:            points,
    borderColor:     vendorColors[label]?.border || "rgba(100,100,200,1)",
    backgroundColor: vendorColors[label]?.bg     || "rgba(100,100,200,0.1)",
    pointRadius:     3,
    showLine:        false,   // scatter — no connecting line
  }));

  lineChart = new Chart(document.getElementById("lineChart"), {
    type: "scatter",
    data: { datasets: scatterDatasets },
    options: {
      ...buildChartOptions("Speed (mph)", textClr, gridClr),
      scales: {
        x: {
          title: { display: true, text: "Distance (mi)", color: textClr, font: { family: "DM Mono" } },
          ticks: { font: { family: "DM Mono" }, color: textClr },
          grid:  { color: gridClr },
        },
        y: {
          title: { display: true, text: "Speed (mph)", color: textClr, font: { family: "DM Mono" } },
          ticks: { font: { family: "DM Mono" }, color: textClr },
          grid:  { color: gridClr },
        },
      },
    },
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