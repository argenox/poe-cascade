// Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.

(function () {
  if (window.electronAPI && window.electronAPI.getPlatform) {
    document.body.classList.add('platform-' + window.electronAPI.getPlatform());
  }
  document.addEventListener('mousedown', function (e) {
    var btn = e.target.closest('.titlebar-controls .titlebar-btn');
    if (!btn || !window.electronAPI) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.id === 'titlebarClose') window.electronAPI.windowClose();
    else if (btn.id === 'titlebarMinimize') window.electronAPI.windowMinimize();
    else if (btn.id === 'titlebarMaximize') window.electronAPI.windowMaximize();
  }, true);

  const CABLE_TYPES = window.POECalculator ? window.POECalculator.getCableTypes() : ['Cat5e', 'Cat6', 'Cat6a', 'Cat7'];

  const state = {
    switchPseWatts: 30,
    devices: [], // each: { deviceDrawWatts, efficiencyPercent, cableLengthMeters, cableType }
  };

  const $ = (id) => document.getElementById(id);
  const $chainContainer = $('chainContainer');
  const $addDevice = $('addDevice');
  const $resultsTable = $('resultsTable');
  const $summary = $('summary');

  function addDevice() {
    state.devices.push({
      deviceDrawWatts: 5,
      efficiencyPercent: 85,
      cableLengthMeters: 10,
      cableType: 'Cat5e',
    });
    renderChain();
    updateResults();
  }

  function removeDevice(index) {
    state.devices.splice(index, 1);
    renderChain();
    updateResults();
  }

  function getChainData() {
    return state.devices.map((d) => ({
      deviceDrawWatts: Number(d.deviceDrawWatts) || 0,
      efficiencyPercent: Number(d.efficiencyPercent) || 80,
      cableLengthMeters: Number(d.cableLengthMeters) || 0,
      cableType: d.cableType || 'Cat5e',
    }));
  }

  function renderChain() {
    const frag = document.createDocumentFragment();

    // PSE output selector (above switch)
    const pseNode = document.createElement('div');
    pseNode.className = 'chain-node pse-selector-node';
    pseNode.innerHTML = `
      <label class="pse-label">PSE output (W)</label>
      <input type="number" id="switchPseWatts" data-field="switchPseWatts" min="1" max="90" value="${state.switchPseWatts}" step="0.5">
      <span class="hint">15.4 / 30 / 60 / 90</span>
    `;
    frag.appendChild(pseNode);

    const arrowPseToSwitch = document.createElement('div');
    arrowPseToSwitch.className = 'chain-connector';
    arrowPseToSwitch.innerHTML = '<span class="connector-arrow">→</span>';
    frag.appendChild(arrowPseToSwitch);

    // Switch node
    const switchNode = document.createElement('div');
    switchNode.className = 'chain-node switch-node';
    switchNode.innerHTML = `
      <div class="node-icon">🔀</div>
      <div class="node-label">Switch</div>
      <div class="node-detail" id="switchPowerOut">${state.switchPseWatts} W</div>
    `;
    frag.appendChild(switchNode);

    state.devices.forEach((d, i) => {
      // Wattage to next stage (after switch or after previous device)
      const connectorOut = document.createElement('div');
      connectorOut.className = 'chain-connector';
      connectorOut.innerHTML = `<span class="power-to-next" data-connector-index="${2 * i}">—</span><span class="connector-arrow">→</span>`;
      frag.appendChild(connectorOut);

      // Cable segment (between previous and this device)
      const cableNode = document.createElement('div');
      cableNode.className = 'chain-node cable-node';
      cableNode.innerHTML = `
        <div class="cable-card">
          <label>Cable</label>
          <div class="cable-length-wrap">
            <input type="number" data-device="${i}" data-field="cableLengthMeters" min="0" max="100" step="1" value="${d.cableLengthMeters}" placeholder="0">
            <span class="cable-unit">m</span>
          </div>
          <select data-device="${i}" data-field="cableType">
            ${CABLE_TYPES.map((t) => `<option value="${t}" ${d.cableType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="cable-loss-value" data-cable-index="${i}">—</div>
      `;
      frag.appendChild(cableNode);

      // Wattage to next stage (after cable, to this device)
      const connectorToDevice = document.createElement('div');
      connectorToDevice.className = 'chain-connector';
      connectorToDevice.innerHTML = `<span class="power-to-next" data-connector-index="${2 * i + 1}">—</span><span class="connector-arrow">→</span>`;
      frag.appendChild(connectorToDevice);

      const deviceNode = document.createElement('div');
      deviceNode.className = 'chain-node device-node';
      deviceNode.innerHTML = `
        <div class="node-icon">📦</div>
        <div class="node-label">Device ${i + 1}</div>
        <div class="device-card">
          <label>Draw (W)</label>
          <input type="number" data-device="${i}" data-field="deviceDrawWatts" min="0" max="90" step="1" value="${d.deviceDrawWatts}">
          <label>Efficiency %</label>
          <input type="number" data-device="${i}" data-field="efficiencyPercent" min="1" max="100" value="${d.efficiencyPercent}">
        </div>
        <button type="button" class="btn btn-danger remove-device" data-index="${i}">Remove</button>
      `;
      frag.appendChild(deviceNode);
    });

    $chainContainer.innerHTML = '';
    $chainContainer.appendChild(frag);

    // Event delegation
    $chainContainer.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      if (!field) return;
      if (field === 'switchPseWatts') {
        state.switchPseWatts = e.target.value;
        updateResults();
        return;
      }
      const dev = e.target.dataset.device;
      if (dev === undefined) return;
      const i = parseInt(dev, 10);
      if (state.devices[i]) {
        state.devices[i][field] = e.target.value;
        updateResults();
        if (field === 'deviceDrawWatts' || field === 'efficiencyPercent') refreshDeviceDetail(i);
      }
    });

    $chainContainer.addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      if (!field) return;
      if (field === 'switchPseWatts') {
        state.switchPseWatts = e.target.value;
        updateResults();
        return;
      }
      const dev = e.target.dataset.device;
      if (dev === undefined) return;
      const i = parseInt(dev, 10);
      if (state.devices[i]) {
        state.devices[i][field] = e.target.value;
        updateResults();
      }
    });

    $chainContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-device')) {
        const index = parseInt(e.target.dataset.index, 10);
        removeDevice(index);
      }
    });
  }

  function refreshDeviceDetail(index) {
    const d = state.devices[index];
    if (!d) return;
    const node = $chainContainer.querySelector(`.device-node .device-card`) && $chainContainer.querySelectorAll('.device-node')[index];
    if (node) {
      const detail = node.querySelector('.node-detail');
      if (detail) detail.textContent = `${d.deviceDrawWatts} W draw, ${d.efficiencyPercent}% eff`;
    }
  }

  function updateResults() {
    const switchPseEl = document.getElementById('switchPseWatts');
    const switchWatts = switchPseEl ? (Number(switchPseEl.value) || 30) : state.switchPseWatts;
    state.switchPseWatts = switchWatts;
    const switchPowerEl = document.getElementById('switchPowerOut');
    if (switchPowerEl) switchPowerEl.textContent = switchWatts + ' W';

    const chain = getChainData();
    const pairModeEl = document.getElementById('cablePairMode');
    const twoPair = pairModeEl ? pairModeEl.value === '2-pair' : true;
    const situationEl = document.getElementById('cableSituation');
    const cableSituation = situationEl ? situationEl.value : 'typical';
    const stages = window.POECalculator ? window.POECalculator.calculateChain(switchWatts, chain, { twoPair, cableSituation }) : [];

    // Update inline: power-to-next between stages, cable loss below each cable
    $chainContainer.querySelectorAll('.power-to-next').forEach((el) => {
      const idx = parseInt(el.dataset.connectorIndex, 10);
      let w = '—';
      if (idx === 0) w = switchWatts.toFixed(2) + ' W';
      else if (stages.length > 0) {
        if (idx % 2 === 1) {
          const stageNum = (idx + 1) / 2;
          if (stages[stageNum]) w = (stages[stageNum].powerAfterCable != null ? stages[stageNum].powerAfterCable.toFixed(2) : '—') + ' W';
        } else {
          const stageNum = idx / 2;
          if (stages[stageNum]) w = (stages[stageNum].pseOut != null ? stages[stageNum].pseOut.toFixed(2) : '—') + ' W';
        }
      }
      el.textContent = w;
    });
    $chainContainer.querySelectorAll('.cable-loss-value').forEach((el) => {
      const idx = parseInt(el.dataset.cableIndex, 10);
      const stageNum = idx + 1;
      const loss = stages[stageNum] && stages[stageNum].cableLoss != null ? stages[stageNum].cableLoss.toFixed(2) : '—';
      el.textContent = loss === '—' ? '—' : `Loss ${loss} W`;
    });

    // Device outline: green when properly powered, red when underpowered
    $chainContainer.querySelectorAll('.device-node').forEach((node, i) => {
      const stage = stages[i + 1]; // stages[0] = switch, stages[1] = device 1, etc.
      node.classList.remove('powered', 'underpowered');
      if (stage) {
        const insufficient = stage.marginNote && stage.marginNote.includes('Insufficient');
        node.classList.add(insufficient ? 'underpowered' : 'powered');
      }
    });

    // Table
    let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Power in (W)</th>
            <th>Cable loss (W)</th>
            <th>After cable (W)</th>
            <th>Device draw (W)</th>
            <th>Efficiency</th>
            <th>PSE out (W)</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
    `;
    stages.forEach((s, i) => {
      const rowClass = s.marginNote && s.marginNote.includes('Insufficient') ? 'no-margin' : s.marginNote ? 'low-margin' : '';
      tableHtml += `
        <tr class="${rowClass}">
          <td>${s.label}</td>
          <td class="num">${s.powerIn != null ? s.powerIn.toFixed(2) : '—'}</td>
          <td class="num">${s.cableLoss != null ? s.cableLoss.toFixed(2) : '—'}</td>
          <td class="num">${s.powerAfterCable != null ? s.powerAfterCable.toFixed(2) : '—'}</td>
          <td class="num">${s.deviceDraw != null ? s.deviceDraw.toFixed(2) : '—'}</td>
          <td class="num">${s.efficiency != null ? s.efficiency + '%' : '—'}</td>
          <td class="num">${s.pseOut != null ? s.pseOut.toFixed(2) : '—'}</td>
          <td>${s.marginNote || '—'}</td>
        </tr>
      `;
    });
    tableHtml += '</tbody></table>';
    $resultsTable.innerHTML = tableHtml;

    // Summary
    const lastStage = stages[stages.length - 1];
    let summaryClass = 'ok';
    let summaryText = '';
    if (state.devices.length === 0) {
      summaryText = 'Add devices to see how many can be cascaded. Configure switch PSE, each device’s draw and efficiency, and cable length/type between stages.';
    } else if (lastStage && lastStage.marginNote && lastStage.marginNote.includes('Insufficient')) {
      summaryClass = 'error';
      summaryText = `<strong>Chain is underpowered.</strong> One or more devices do not receive enough power. Reduce draw, shorten cables, use better cable (e.g. Cat6a), or increase switch PSE.`;
    } else if (lastStage && lastStage.pseOut < 1) {
      summaryClass = 'warn';
      summaryText = `<strong>Maximum cascade in this configuration:</strong> ${state.devices.length} device(s). No usable power remains after the last device.`;
    } else {
      summaryText = `<strong>Usable cascade:</strong> ${state.devices.length} device(s). Remaining power after last device: <strong>${(lastStage && lastStage.pseOut != null ? lastStage.pseOut.toFixed(2) : 0)} W</strong>. You can add more devices if they need less than this.`;
    }
    $summary.className = 'summary ' + summaryClass;
    $summary.innerHTML = summaryText;
  }

  $addDevice.addEventListener('click', addDevice);

  const cablePairModeEl = document.getElementById('cablePairMode');
  if (cablePairModeEl) cablePairModeEl.addEventListener('change', updateResults);
  const cableSituationEl = document.getElementById('cableSituation');
  if (cableSituationEl) cableSituationEl.addEventListener('change', updateResults);

  renderChain();
  updateResults();
})();
