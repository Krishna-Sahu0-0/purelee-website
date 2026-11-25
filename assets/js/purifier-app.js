(function () {
  "use strict";

  const OFFLINE_THRESHOLD_SEC = 900; // 15 minutes (3 missed 5-min heartbeats)
  const PRE_LIMIT_L = 3500;
  const GROUP_LIMIT_L = 7000;
  const UV_LIMIT_L = 7000;

  const cfg = window.PURELEE_SUPABASE_CONFIG || {};
  const isConfigured =
    typeof cfg.url === "string" &&
    cfg.url.startsWith("https://") &&
    !cfg.url.includes("YOUR_PROJECT_REF") &&
    typeof cfg.anonKey === "string" &&
    cfg.anonKey.length > 20 &&
    !cfg.anonKey.includes("YOUR_SUPABASE_ANON_KEY");

  const els = {
    configWarning: document.getElementById("configWarning"),
    authSection: document.getElementById("authSection"),
    tabSignIn: document.getElementById("tabSignIn"),
    tabSignUp: document.getElementById("tabSignUp"),
    fullNameGroup: document.getElementById("fullNameGroup"),
    authFullName: document.getElementById("authFullName"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authForm: document.getElementById("authForm"),
    authSubmitBtn: document.getElementById("authSubmitBtn"),
    authMsg: document.getElementById("authMsg"),
    dashboardSection: document.getElementById("dashboardSection"),
    userEmailLabel: document.getElementById("userEmailLabel"),
    deviceSelectWrap: document.getElementById("deviceSelectWrap"),
    deviceSelect: document.getElementById("deviceSelect"),
    openClaimBtn: document.getElementById("openClaimBtn"),
    emptyAddBtn: document.getElementById("emptyAddBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    emptyDeviceState: document.getElementById("emptyDeviceState"),
    deviceContent: document.getElementById("deviceContent"),
    devTitle: document.getElementById("devTitle"),
    devIdLabel: document.getElementById("devIdLabel"),
    devFwLabel: document.getElementById("devFwLabel"),
    devLastSeen: document.getElementById("devLastSeen"),
    connBadge: document.getElementById("connBadge"),
    heroOnlineBadge: document.getElementById("heroOnlineBadge"),
    alertsContainer: document.getElementById("alertsContainer"),
    kpiTotal: document.getElementById("kpiTotal"),
    kpiToday: document.getElementById("kpiToday"),
    kpiWeek: document.getElementById("kpiWeek"),
    kpiMonth: document.getElementById("kpiMonth"),
    kpiFlow: document.getElementById("kpiFlow"),
    tdsValue: document.getElementById("tdsValue"),
    tdsStatusText: document.getElementById("tdsStatusText"),
    tdsRecoveryText: document.getElementById("tdsRecoveryText"),
    pumpStatusValue: document.getElementById("pumpStatusValue"),
    pumpStatusDesc: document.getElementById("pumpStatusDesc"),
    prePct: document.getElementById("prePct"),
    preRem: document.getElementById("preRem"),
    preBar: document.getElementById("preBar"),
    preNote: document.getElementById("preNote"),
    groupPct: document.getElementById("groupPct"),
    groupRem: document.getElementById("groupRem"),
    groupBar: document.getElementById("groupBar"),
    groupNote: document.getElementById("groupNote"),
    uvPct: document.getElementById("uvPct"),
    uvRem: document.getElementById("uvRem"),
    uvBar: document.getElementById("uvBar"),
    uvNote: document.getElementById("uvNote"),
    eventsList: document.getElementById("eventsList"),
    claimModal: document.getElementById("claimModal"),
    closeClaimBtn: document.getElementById("closeClaimBtn"),
    claimForm: document.getElementById("claimForm"),
    claimDeviceId: document.getElementById("claimDeviceId"),
    claimCode: document.getElementById("claimCode"),
    claimNickname: document.getElementById("claimNickname"),
    claimSubmitBtn: document.getElementById("claimSubmitBtn"),
    claimMsg: document.getElementById("claimMsg"),
    scanQrBtn: document.getElementById("scanQrBtn"),
    qrScannerBox: document.getElementById("qrScannerBox"),
    qrVideo: document.getElementById("qrVideo"),
    stopScanBtn: document.getElementById("stopScanBtn"),
  };

  let supabaseClient = null;
  let authMode = "signin";
  let currentUser = null;
  let devices = [];
  let activeDeviceId = null;
  let latestTelemetry = null;
  let dailyUsageRows = [];
  let historyRows = [];
  let realtimeChannel = null;
  let offlineTicker = null;
  let usageChartInstance = null;
  let tdsChartInstance = null;
  let qrStream = null;
  let qrTimer = null;

  function showEl(el, show) {
    if (!el) return;
    el.classList.toggle("sp-hidden", !show);
  }

  function showMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.className = "sp-msg " + (isError ? "sp-msg-error" : "sp-msg-success");
  }

  function clearMessage(el) {
    if (!el) return;
    el.textContent = "";
    el.className = "sp-msg sp-hidden";
  }

  function formatISTDate(dateObj, timeZone) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
  }

  function formatDisplayTimestamp(isoString, timeZone) {
    if (!isoString) return "Never";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timeZone || "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  }

  function getActiveDevice() {
    return devices.find((d) => d.device_id === activeDeviceId) || null;
  }

  function isDeviceOnline(telemetry) {
    if (!telemetry || !telemetry.last_seen_at) return false;
    const ageSec = (Date.now() - new Date(telemetry.last_seen_at).getTime()) / 1000;
    return ageSec <= OFFLINE_THRESHOLD_SEC;
  }

  function setAuthMode(mode) {
    authMode = mode;
    els.tabSignIn.classList.toggle("active", mode === "signin");
    els.tabSignUp.classList.toggle("active", mode === "signup");
    showEl(els.fullNameGroup, mode === "signup");
    els.authSubmitBtn.textContent = mode === "signup" ? "Create Account" : "Sign In";
    els.authPassword.setAttribute(
      "autocomplete",
      mode === "signup" ? "new-password" : "current-password"
    );
    clearMessage(els.authMsg);
  }

  function parseQueryParamsForClaim() {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get("device") || params.get("device_id");
    const code = params.get("code") || params.get("claim_code");
    if (dev) els.claimDeviceId.value = dev.trim().toUpperCase();
    if (code) els.claimCode.value = code.trim().toUpperCase();
  }

  function renderConnectionState() {
    const dev = getActiveDevice();
    if (!dev) {
      els.heroOnlineBadge.innerHTML = "";
      return;
    }

    const tz = dev.timezone || "Asia/Kolkata";
    const online = isDeviceOnline(latestTelemetry);

    els.devLastSeen.textContent = latestTelemetry
      ? formatDisplayTimestamp(latestTelemetry.last_seen_at, tz)
      : "Waiting for first upload";

    els.connBadge.className = "sp-badge " + (online ? "sp-badge-online" : "sp-badge-offline");
    els.connBadge.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "sp-dot";
    els.connBadge.appendChild(dot);
    els.connBadge.appendChild(document.createTextNode(online ? "ONLINE" : "OFFLINE (>15m)"));

    els.heroOnlineBadge.innerHTML = "";
    const heroBadge = document.createElement("span");
    heroBadge.className = "sp-badge " + (online ? "sp-badge-online" : "sp-badge-offline");
    const heroDot = document.createElement("span");
    heroDot.className = "sp-dot";
    heroBadge.appendChild(heroDot);
    heroBadge.appendChild(
      document.createTextNode(
        (dev.device_name || dev.device_id) + (online ? " \u2022 Online" : " \u2022 Offline")
      )
    );
    els.heroOnlineBadge.appendChild(heroBadge);
  }

  function createAlertElement(level, title, body) {
    const box = document.createElement("div");
    box.className =
      "sp-alert " +
      (level === "critical"
        ? "sp-alert-critical"
        : level === "warning"
        ? "sp-alert-warning"
        : "sp-alert-ok");

    const inner = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = body;
    inner.appendChild(strong);
    inner.appendChild(span);
    box.appendChild(inner);
    return box;
  }

  function renderAlerts(t) {
    els.alertsContainer.innerHTML = "";
    const online = isDeviceOnline(t);
    let count = 0;

    if (!online) {
      count++;
      els.alertsContainer.appendChild(
        createAlertElement(
          "critical",
          "Device Offline",
          "No heartbeat received in the last 15 minutes. Check purifier power and home Wi-Fi. Local TDS and filter protection remain active on the unit."
        )
      );
    }

    if (t && t.tds_sensor_fault) {
      count++;
      els.alertsContainer.appendChild(
        createAlertElement(
          "critical",
          "TDS Sensor Problem \u2014 Pump Stopped",
          "TDS probe signal is outside valid bounds (0.015 V \u2013 2.60 V). Pump is locked OFF for safety until inspected."
        )
      );
    }

    if (t && t.tds_fault) {
      count++;
      const msg =
        t.tds_ppm < 500 && !t.tds_sensor_fault
          ? "TDS has dropped below 500 ppm. Auto-recovery stability check: " +
            (t.tds_recovery_sec || 0) +
            " / 60 seconds."
          : "Measured TDS reached 500 ppm or higher. Pump is stopped until water stays below 500 ppm continuously for 60 seconds.";
      els.alertsContainer.appendChild(
        createAlertElement("critical", "High TDS Fault \u2014 Pump Stopped", msg)
      );
    }

    if (t && t.group_expired) {
      count++;
      els.alertsContainer.appendChild(
        createAlertElement(
          "critical",
          "Combined Filter Replacement Due (7,000 L) \u2014 Pump Locked",
          "Sediment, Pre-carbon, and Post-carbon cartridge capacity reached 7,000 L. Contact PURELEE service for replacement."
        )
      );
    }

    if (t && t.pre_expired) {
      count++;
      els.alertsContainer.appendChild(
        createAlertElement(
          "warning",
          "Pre-filter Replacement Due (3,500 L)",
          "Pre-filter life has reached 3,500 L. Purifier continues running, please schedule pre-filter replacement soon."
        )
      );
    }

    if (t && t.uv_due) {
      count++;
      els.alertsContainer.appendChild(
        createAlertElement(
          "warning",
          "UV Service Reminder (7,000 L)",
          "7,000 L UV service interval reached. Purifier continues running; schedule a UV inspection with PURELEE."
        )
      );
    }

    if (t && t.unexpected_flow) {
      count++;
      els.alertsContainer.appendChild(
        createAlertElement(
          "warning",
          "Unexpected Flow Detected",
          "Water flow was detected while the pump was commanded OFF. Contact PURELEE service if this persists."
        )
      );
    }

    if (count === 0) {
      els.alertsContainer.appendChild(
        createAlertElement(
          "ok",
          "All Systems Normal",
          "Water quality, filter life, and pump protection checks are within normal operating limits."
        )
      );
    }
  }

  function updateFilterCard(remEl, pctEl, barEl, noteEl, remaining, limit, isExpired, expiredText) {
    const rem = Math.max(0, Number(remaining || 0));
    const pct = Math.max(0, Math.min(100, (rem / limit) * 100));

    remEl.textContent = rem.toFixed(0) + " L left";
    pctEl.textContent = pct.toFixed(0) + "%";
    barEl.style.width = pct.toFixed(1) + "%";

    barEl.className = "sp-bar-fill";
    if (isExpired || pct <= 0) {
      barEl.classList.add("bar-bad");
      noteEl.textContent = expiredText;
    } else if (pct < 20) {
      barEl.classList.add("bar-warn");
      noteEl.textContent = "Low remaining life \u2014 plan service soon";
    } else {
      noteEl.textContent = "Healthy filter capacity remaining";
    }
  }

  function renderConsumptionSummary() {
    const dev = getActiveDevice();
    const tz = (dev && dev.timezone) || "Asia/Kolkata";

    const todayStr = formatISTDate(new Date(), tz);
    const d7 = new Date(Date.now() - 6 * 86400000);
    const d30 = new Date(Date.now() - 29 * 86400000);
    const weekStartStr = formatISTDate(d7, tz);
    const monthStartStr = formatISTDate(d30, tz);

    let todayL = 0;
    let weekL = 0;
    let monthL = 0;

    for (const row of dailyUsageRows) {
      const val = Number(row.litres_consumed || 0);
      if (row.usage_date === todayStr) todayL += val;
      if (row.usage_date >= weekStartStr && row.usage_date <= todayStr) weekL += val;
      if (row.usage_date >= monthStartStr && row.usage_date <= todayStr) monthL += val;
    }

    els.kpiToday.textContent = todayL.toFixed(1) + " L";
    els.kpiWeek.textContent = weekL.toFixed(1) + " L";
    els.kpiMonth.textContent = monthL.toFixed(1) + " L";
  }

  function renderTelemetry() {
    const dev = getActiveDevice();
    if (!dev) return;

    els.devTitle.textContent = dev.device_name || "PURELEE Smart Purifier";
    els.devIdLabel.textContent = dev.device_id;
    els.devFwLabel.textContent =
      (latestTelemetry && latestTelemetry.fw_version) || dev.fw_version || "--";

    renderConnectionState();
    renderAlerts(latestTelemetry);
    renderConsumptionSummary();

    if (!latestTelemetry) {
      els.kpiTotal.textContent = "-- L";
      els.kpiFlow.textContent = "-- L/min";
      els.tdsValue.textContent = "-- ppm";
      els.tdsStatusText.textContent = "Waiting for telemetry...";
      els.tdsRecoveryText.textContent = "";
      els.pumpStatusValue.textContent = "--";
      els.pumpStatusDesc.textContent = "Waiting for telemetry...";
      return;
    }

    const t = latestTelemetry;
    const online = isDeviceOnline(t);

    els.kpiTotal.textContent = Number(t.total_litres || 0).toFixed(1) + " L";
    els.kpiFlow.textContent = Number(t.flow_rate_lpm || 0).toFixed(2) + " L/min";

    // TDS card
    els.tdsValue.textContent = Number(t.tds_ppm || 0).toFixed(0) + " ppm";
    if (t.tds_sensor_fault) {
      els.tdsValue.className = "sp-status-val sp-status-bad";
      els.tdsStatusText.textContent = "Sensor fault detected (check probe)";
      els.tdsRecoveryText.textContent = "";
    } else if (t.tds_fault) {
      els.tdsValue.className = "sp-status-val sp-status-bad";
      els.tdsStatusText.textContent = "High TDS protection active (>= 500 ppm)";
      els.tdsRecoveryText.textContent =
        t.tds_ppm < 500
          ? "60 s recovery progress: " + (t.tds_recovery_sec || 0) + " / 60 s"
          : "Waiting for TDS to drop below 500 ppm";
    } else {
      els.tdsValue.className = "sp-status-val sp-status-good";
      els.tdsStatusText.textContent = "Within operating limit (< 500 ppm)";
      els.tdsRecoveryText.textContent = "";
    }

    // Pump card
    if (!online) {
      els.pumpStatusValue.className = "sp-status-val sp-status-warn";
      els.pumpStatusValue.textContent = "Offline";
      els.pumpStatusDesc.textContent = "Last reported state before disconnect: " + (t.pump_running ? "Running" : "Stopped");
    } else if (t.tds_fault || t.tds_sensor_fault) {
      els.pumpStatusValue.className = "sp-status-val sp-status-bad";
      els.pumpStatusValue.textContent = "TDS Protection Active";
      els.pumpStatusDesc.textContent = "Pump stopped automatically to protect drinking water quality";
    } else if (t.group_expired) {
      els.pumpStatusValue.className = "sp-status-val sp-status-bad";
      els.pumpStatusValue.textContent = "Filter Lock Active";
      els.pumpStatusDesc.textContent = "Pump stopped until combined filter group is serviced";
    } else if (t.startup_hold) {
      els.pumpStatusValue.className = "sp-status-val sp-status-warn";
      els.pumpStatusValue.textContent = "Boot Stabilizing";
      els.pumpStatusDesc.textContent = "3-second power-on stabilization check";
    } else if (t.pump_running) {
      els.pumpStatusValue.className = "sp-status-val sp-status-good";
      els.pumpStatusValue.textContent = "Pump Running";
      els.pumpStatusDesc.textContent = "Normal purification enabled";
    } else {
      els.pumpStatusValue.className = "sp-status-val sp-status-warn";
      els.pumpStatusValue.textContent = "Pump Stopped";
      els.pumpStatusDesc.textContent = "Standby / service lock";
    }

    updateFilterCard(
      els.preRem,
      els.prePct,
      els.preBar,
      els.preNote,
      t.pre_remaining_l,
      PRE_LIMIT_L,
      t.pre_expired,
      "Pre-filter due (pump continues running)"
    );

    updateFilterCard(
      els.groupRem,
      els.groupPct,
      els.groupBar,
      els.groupNote,
      t.group_remaining_l,
      GROUP_LIMIT_L,
      t.group_expired,
      "Combined group expired \u2014 service lock active"
    );

    updateFilterCard(
      els.uvRem,
      els.uvPct,
      els.uvBar,
      els.uvNote,
      t.uv_remaining_l,
      UV_LIMIT_L,
      t.uv_due,
      "UV service reminder due (litre-based)"
    );
  }

  function renderCharts() {
    if (typeof window.Chart !== "function") return;

    const dev = getActiveDevice();
    const tz = (dev && dev.timezone) || "Asia/Kolkata";

    // Build continuous last 14 IST dates
    const usageMap = new Map();
    for (const r of dailyUsageRows) {
      usageMap.set(r.usage_date, Number(r.litres_consumed || 0));
    }

    const dayLabels = [];
    const dayValues = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = formatISTDate(d, tz);
      dayLabels.push(key.slice(5)); // MM-DD
      dayValues.push(Number((usageMap.get(key) || 0).toFixed(2)));
    }

    const usageCtx = document.getElementById("usageChart").getContext("2d");
    if (usageChartInstance) usageChartInstance.destroy();
    usageChartInstance = new window.Chart(usageCtx, {
      type: "bar",
      data: {
        labels: dayLabels,
        datasets: [
          {
            label: "Litres Used",
            data: dayValues,
            backgroundColor: "#1565c0",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Litres" } },
        },
      },
    });

    // TDS & Flow Trend
    const sortedHist = [...historyRows].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    const histLabels = sortedHist.map((r) =>
      new Intl.DateTimeFormat("en-IN", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(r.recorded_at))
    );
    const tdsSeries = sortedHist.map((r) => Number(r.tds_ppm || 0));
    const flowSeries = sortedHist.map((r) => Number(r.flow_rate_lpm || 0));

    const tdsCtx = document.getElementById("tdsChart").getContext("2d");
    if (tdsChartInstance) tdsChartInstance.destroy();
    tdsChartInstance = new window.Chart(tdsCtx, {
      type: "line",
      data: {
        labels: histLabels,
        datasets: [
          {
            label: "TDS (ppm)",
            data: tdsSeries,
            borderColor: "#1a2a6c",
            backgroundColor: "rgba(26,42,108,0.1)",
            tension: 0.25,
            yAxisID: "y",
          },
          {
            label: "Flow (L/min)",
            data: flowSeries,
            borderColor: "#16864b",
            backgroundColor: "rgba(22,134,75,0.1)",
            tension: 0.25,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, position: "left", title: { display: true, text: "ppm" } },
          y1: {
            beginAtZero: true,
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: "L/min" },
          },
        },
      },
    });
  }

  function renderEvents(events) {
    els.eventsList.innerHTML = "";
    if (!events || events.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No service events recorded yet.";
      els.eventsList.appendChild(li);
      return;
    }

    const dev = getActiveDevice();
    const tz = (dev && dev.timezone) || "Asia/Kolkata";

    for (const ev of events) {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const typeSpan = document.createElement("span");
      typeSpan.className = "sp-event-type";
      typeSpan.textContent = ev.event_type.replace(/_/g, " ");
      left.appendChild(typeSpan);
      if (ev.notes) {
        const note = document.createElement("div");
        note.className = "sp-kpi-sub";
        note.textContent = ev.notes;
        left.appendChild(note);
      }

      const right = document.createElement("span");
      right.className = "sp-event-time";
      right.textContent = formatDisplayTimestamp(ev.created_at, tz);

      li.appendChild(left);
      li.appendChild(right);
      els.eventsList.appendChild(li);
    }
  }

  function teardownRealtime() {
    if (realtimeChannel && supabaseClient) {
      supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  }

  function subscribeRealtime(deviceId) {
    teardownRealtime();
    if (!supabaseClient || !deviceId) return;

    realtimeChannel = supabaseClient
      .channel("purifier-" + deviceId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "telemetry_latest",
          filter: "device_id=eq." + deviceId,
        },
        (payload) => {
          if (payload.new) {
            latestTelemetry = payload.new;
            renderTelemetry();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_usage",
          filter: "device_id=eq." + deviceId,
        },
        (payload) => {
          if (payload.new && payload.new.usage_date) {
            const idx = dailyUsageRows.findIndex(
              (r) => r.usage_date === payload.new.usage_date
            );
            if (idx >= 0) dailyUsageRows[idx] = payload.new;
            else dailyUsageRows.push(payload.new);
            renderConsumptionSummary();
            renderCharts();
          }
        }
      )
      .subscribe();
  }

  async function loadDeviceData(deviceId) {
    if (!supabaseClient || !deviceId) return;
    activeDeviceId = deviceId;

    const dev = getActiveDevice();
    const tz = (dev && dev.timezone) || "Asia/Kolkata";
    const start30Str = formatISTDate(new Date(Date.now() - 29 * 86400000), tz);

    const [latestRes, usageRes, histRes, eventsRes] = await Promise.all([
      supabaseClient
        .from("telemetry_latest")
        .select("*")
        .eq("device_id", deviceId)
        .maybeSingle(),
      supabaseClient
        .from("daily_usage")
        .select("usage_date, litres_consumed, avg_tds_ppm, max_tds_ppm")
        .eq("device_id", deviceId)
        .gte("usage_date", start30Str)
        .order("usage_date", { ascending: true }),
      supabaseClient
        .from("telemetry_history")
        .select("recorded_at, tds_ppm, flow_rate_lpm")
        .eq("device_id", deviceId)
        .order("recorded_at", { ascending: false })
        .limit(36),
      supabaseClient
        .from("service_events")
        .select("event_type, notes, created_at")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    latestTelemetry = latestRes.data || null;
    dailyUsageRows = usageRes.data || [];
    historyRows = histRes.data || [];

    renderTelemetry();
    renderCharts();
    renderEvents(eventsRes.data || []);
    subscribeRealtime(deviceId);
  }

  async function loadCustomerDevices() {
    if (!supabaseClient || !currentUser) return;

    const { data, error } = await supabaseClient
      .from("customer_devices")
      .select("device_id, product_model, device_name, timezone, fw_version, claimed_at")
      .order("claimed_at", { ascending: false });

    if (error) {
      devices = [];
    } else {
      devices = data || [];
    }

    if (devices.length === 0) {
      activeDeviceId = null;
      teardownRealtime();
      showEl(els.deviceSelectWrap, false);
      showEl(els.emptyDeviceState, true);
      showEl(els.deviceContent, false);
      els.heroOnlineBadge.innerHTML = "";
      return;
    }

    showEl(els.emptyDeviceState, false);
    showEl(els.deviceContent, true);
    showEl(els.deviceSelectWrap, devices.length > 1);

    els.deviceSelect.innerHTML = "";
    for (const d of devices) {
      const opt = document.createElement("option");
      opt.value = d.device_id;
      opt.textContent = (d.device_name || "Purifier") + " (" + d.device_id + ")";
      els.deviceSelect.appendChild(opt);
    }

    const chosen =
      activeDeviceId && devices.some((d) => d.device_id === activeDeviceId)
        ? activeDeviceId
        : devices[0].device_id;
    els.deviceSelect.value = chosen;

    await loadDeviceData(chosen);
  }

  function applySession(session) {
    currentUser = session ? session.user : null;

    if (!currentUser) {
      teardownRealtime();
      if (offlineTicker) {
        clearInterval(offlineTicker);
        offlineTicker = null;
      }
      showEl(els.authSection, true);
      showEl(els.dashboardSection, false);
      els.heroOnlineBadge.innerHTML = "";
      return;
    }

    els.userEmailLabel.textContent = currentUser.email || "Customer";
    showEl(els.authSection, false);
    showEl(els.dashboardSection, true);

    if (!offlineTicker) {
      offlineTicker = setInterval(() => {
        if (activeDeviceId) renderConnectionState();
      }, 15000);
    }

    loadCustomerDevices();
  }

  // Modal & QR Scanner
  function stopQrScanner() {
    if (qrTimer) {
      clearInterval(qrTimer);
      qrTimer = null;
    }
    if (qrStream) {
      qrStream.getTracks().forEach((t) => t.stop());
      qrStream = null;
    }
    els.qrVideo.srcObject = null;
    showEl(els.qrScannerBox, false);
  }

  async function startQrScanner() {
    if (!("BarcodeDetector" in window)) return;
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      els.qrVideo.srcObject = qrStream;
      await els.qrVideo.play();
      showEl(els.qrScannerBox, true);

      qrTimer = setInterval(async () => {
        if (!qrStream) return;
        try {
          const codes = await detector.detect(els.qrVideo);
          if (codes && codes.length > 0) {
            const raw = codes[0].rawValue || "";
            if (raw.includes("device=") || raw.includes("code=")) {
              const u = new URL(raw.startsWith("http") ? raw : "https://purelee.in/?" + raw);
              const d = u.searchParams.get("device") || u.searchParams.get("device_id");
              const c = u.searchParams.get("code") || u.searchParams.get("claim_code");
              if (d) els.claimDeviceId.value = d.trim().toUpperCase();
              if (c) els.claimCode.value = c.trim().toUpperCase();
            } else if (raw.includes(":")) {
              const parts = raw.split(":");
              els.claimDeviceId.value = parts[0].trim().toUpperCase();
              els.claimCode.value = (parts[1] || "").trim().toUpperCase();
            }
            stopQrScanner();
          }
        } catch {
          // Ignore frame detection miss
        }
      }, 450);
    } catch {
      showMessage(els.claimMsg, "Camera access unavailable. Enter Device ID and Claim Code manually.", true);
      stopQrScanner();
    }
  }

  function openClaimModal() {
    clearMessage(els.claimMsg);
    showEl(els.claimModal, true);
  }

  function closeClaimModal() {
    stopQrScanner();
    showEl(els.claimModal, false);
  }

  // Event Listeners
  els.tabSignIn.addEventListener("click", () => setAuthMode("signin"));
  els.tabSignUp.addEventListener("click", () => setAuthMode("signup"));

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;
    clearMessage(els.authMsg);
    els.authSubmitBtn.disabled = true;

    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    const fullName = els.authFullName.value.trim();

    try {
      if (authMode === "signup") {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          showMessage(els.authMsg, error.message, true);
        } else if (!data.session) {
          showMessage(
            els.authMsg,
            "Account created. Please check your email inbox to confirm your address, then sign in.",
            false
          );
        }
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          showMessage(els.authMsg, error.message, true);
        }
      }
    } catch {
      showMessage(els.authMsg, "Network error while signing in. Please try again.", true);
    } finally {
      els.authSubmitBtn.disabled = false;
    }
  });

  els.signOutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  });

  els.deviceSelect.addEventListener("change", () => {
    loadDeviceData(els.deviceSelect.value);
  });

  els.openClaimBtn.addEventListener("click", openClaimModal);
  els.emptyAddBtn.addEventListener("click", openClaimModal);
  els.closeClaimBtn.addEventListener("click", closeClaimModal);
  els.stopScanBtn.addEventListener("click", stopQrScanner);
  els.scanQrBtn.addEventListener("click", startQrScanner);

  els.claimForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;
    clearMessage(els.claimMsg);
    els.claimSubmitBtn.disabled = true;

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session) {
        showMessage(els.claimMsg, "Please sign in again before pairing a purifier.", true);
        return;
      }

      const resp = await fetch(cfg.url.replace(/\/$/, "") + "/functions/v1/claim-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
          apikey: cfg.anonKey,
        },
        body: JSON.stringify({
          device_id: els.claimDeviceId.value.trim().toUpperCase(),
          claim_code: els.claimCode.value.trim().toUpperCase(),
          device_name: els.claimNickname.value.trim(),
        }),
      });

      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showMessage(els.claimMsg, result.error || "Could not pair purifier.", true);
        return;
      }

      activeDeviceId = result.device_id || els.claimDeviceId.value.trim().toUpperCase();
      closeClaimModal();
      els.claimForm.reset();
      await loadCustomerDevices();
    } catch {
      showMessage(els.claimMsg, "Network error while connecting purifier.", true);
    } finally {
      els.claimSubmitBtn.disabled = false;
    }
  });

  // Boot
  parseQueryParamsForClaim();
  if ("BarcodeDetector" in window && navigator.mediaDevices) {
    showEl(els.scanQrBtn, true);
  }

  if (!isConfigured || !window.supabase) {
    showEl(els.configWarning, true);
    showEl(els.authSection, true);
    els.authSubmitBtn.disabled = true;
    return;
  }

  supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);

  supabaseClient.auth.getSession().then(({ data }) => {
    applySession(data ? data.session : null);
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
})();
