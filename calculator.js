/**
 * Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.
 *
 * POE Cascade Calculator (browser-safe)
 * Cable loss and power flow through the chain.
 * POE nominal 48V. P_loss = I²R with I = P/48.
 * Base R is calibrated so "typical" at 100 m gives 9–12 W (mid 10.5 W) at 90 W;
 * cable situation then scales to cool/warm/worst per the 100 m reference table.
 */
(function (global) {
  const POE_VOLTAGE = 48;

  // Base R (2-pair) so that at 90 W, 100 m, "typical" = 10.5 W → R_100m = 10.5/(90/48)² ≈ 2.99 Ω.
  const CABLE_TYPES = {
    'Cat5e':   { resistancePerMeter: 0.0299, name: 'Cat5e' },
    'Cat6':    { resistancePerMeter: 0.0267, name: 'Cat6' },
    'Cat6a':   { resistancePerMeter: 0.0236, name: 'Cat6a' },
    'Cat7':    { resistancePerMeter: 0.0217, name: 'Cat7' },
  };

  function cablePowerLoss(wattsThroughCable, lengthMeters, cableTypeKey, twoPair) {
    const cable = CABLE_TYPES[cableTypeKey] || CABLE_TYPES['Cat5e'];
    let R = cable.resistancePerMeter * lengthMeters;
    if (twoPair === false) R *= 2; // 1-pair: double loop resistance
    const I = wattsThroughCable / POE_VOLTAGE;
    return I * I * R;
  }

  function powerAfterCable(wattsIn, lengthMeters, cableTypeKey, twoPair) {
    if (lengthMeters <= 0) return wattsIn;
    const loss = cablePowerLoss(wattsIn, lengthMeters, cableTypeKey, twoPair);
    return Math.max(0, wattsIn - loss);
  }

  function devicePseOutput(pdInputWatts, deviceDrawWatts, efficiencyPercent) {
    const efficiency = efficiencyPercent / 100;
    const remaining = Math.max(0, pdInputWatts - deviceDrawWatts);
    return remaining * efficiency;
  }

  // Cable situation: loss multiplier vs "typical" (temperature/bundling). Ref loss at 100 m.
  const CABLE_SITUATION_MULTIPLIERS = {
    cool:    9 / 10.5,   // 8–10 W → 9
    typical: 10.5 / 10.5, // 9–12 W → 10.5 (baseline)
    warm:    13 / 10.5,   // 12–14 W → 13
    worst:   16 / 10.5,   // 15–17 W → 16
  };

  function calculateChain(switchPseWatts, chain, options) {
    const twoPair = options && options.twoPair !== false;
    const situation = (options && options.cableSituation) || 'typical';
    const lossMultiplier = CABLE_SITUATION_MULTIPLIERS[situation] != null
      ? CABLE_SITUATION_MULTIPLIERS[situation]
      : 1;
    const stages = [];
    let powerAtStage = switchPseWatts;

    stages.push({
      label: 'Switch (PSE)',
      powerIn: null,
      cableLoss: null,
      powerAfterCable: null,
      deviceDraw: null,
      efficiency: null,
      pseOut: switchPseWatts,
      marginNote: null,
    });

    for (let i = 0; i < chain.length; i++) {
      const link = chain[i];
      const cableLength = link.cableLengthMeters || 0;
      const cableType = link.cableType || 'Cat5e';

      let loss = cableLength > 0 ? cablePowerLoss(powerAtStage, cableLength, cableType, twoPair) : 0;
      loss *= lossMultiplier;
      const powerAfterCable = powerAtStage - loss;

      const deviceDraw = link.deviceDrawWatts || 0;
      const efficiency = (link.efficiencyPercent || 80) / 100;
      const remaining = Math.max(0, powerAfterCable - deviceDraw);
      const pseOut = remaining * efficiency;

      let marginNote = null;
      if (powerAfterCable < deviceDraw) {
        marginNote = 'Insufficient power (device cannot operate)';
      } else if (pseOut < 1 && i < chain.length - 1) {
        marginNote = 'No margin for next device';
      } else if (powerAfterCable - deviceDraw < 1) {
        marginNote = 'Minimal margin';
      }

      stages.push({
        label: `Device ${i + 1}`,
        powerIn: powerAtStage,
        cableLoss: loss,
        powerAfterCable,
        deviceDraw,
        efficiency: link.efficiencyPercent || 80,
        pseOut,
        marginNote,
      });

      powerAtStage = pseOut;
    }

    return stages;
  }

  function getCableTypes() {
    return Object.keys(CABLE_TYPES);
  }

  global.POECalculator = {
    POE_VOLTAGE,
    CABLE_TYPES,
    cablePowerLoss,
    powerAfterCable,
    devicePseOutput,
    calculateChain,
    getCableTypes,
  };
})(typeof window !== 'undefined' ? window : this);
